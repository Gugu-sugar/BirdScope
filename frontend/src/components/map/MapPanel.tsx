import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useEffect, useRef } from "react";
import { queryGrid } from "../../api/stats";
import type { ActiveQuery } from "../../store/queryStore";
import { useQueryStore } from "../../store/queryStore";

import {
  CircleDot, Crosshair, Layers3, MapPin, Pentagon, Ruler, Square
} from "lucide-react";
import type {
  Bbox, BufferSelection, GeoJsonPolygon, LngLat, SpatialMode
} from "../../types/geo";

// 联动热力网格的分级配色（YlOrRd），断点与 grid_heatmap.sld 一致。
function gridCellColor(count: number): Cesium.Color {
  const hex =
    count <= 10 ? "#ffffb2"
    : count <= 50 ? "#fed976"
    : count <= 150 ? "#feb24c"
    : count <= 400 ? "#fd8d3c"
    : count <= 1000 ? "#fc4e2a"
    : count <= 2500 ? "#e31a1c"
    : "#b10026";
  return Cesium.Color.fromCssColorString(hex).withAlpha(0.55);
}

// 按 bbox 跨度选网格粒度：小范围 0.5°，大范围 1.0°（与后端预聚合粒度对齐）。
function pickGridSize(bbox: Bbox): number {
  const span = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1]);
  return span <= 10 ? 0.5 : 1.0;
}

const GEOSERVER_WMS_URL =
  import.meta.env.VITE_GEOSERVER_WMS_URL ??
  "http://localhost:8080/geoserver/birdscope/wms";
const FAR_VIEW_HEIGHT = 2_500_000;

type MapPanelProps = {
  spatialMode: SpatialMode;
  bbox: Bbox | null;
  polygon: GeoJsonPolygon | null;
  buffer: BufferSelection | null;
  activeQuery: ActiveQuery | null;
  onBboxSelected: (bbox: Bbox) => void;
  onPolygonSelected: (geometry: GeoJsonPolygon) => void;
  onBufferCenterSelected: (point: LngLat) => void;
};

const SAMPLE_BBOX: Bbox = [70, 20, 140, 55];
const SAMPLE_POLYGON: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [[[116, 39], [117, 39], [117, 40], [116, 40], [116, 39]]]
};
const SAMPLE_BUFFER_CENTER: LngLat = { lng: 121.5, lat: 31.2 };

export function MapPanel({
  spatialMode, bbox, polygon, buffer, activeQuery, onBboxSelected, onPolygonSelected, onBufferCenterSelected
}: MapPanelProps) {

  const { results, month } = useQueryStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const drawStartPos = useRef<Cesium.Cartesian3 | null>(null);
  const polyPoints = useRef<Cesium.Cartesian3[]>([]);
  const wmsLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const gridDsRef = useRef<Cesium.GeoJsonDataSource | null>(null);

  // 1. 初始化地图
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false, timeline: false, fullscreenButton: false,
      baseLayerPicker: false, infoBox: false, selectionIndicator: false,
      navigationHelpButton: false, sceneModePicker: false,
      terrain: Cesium.Terrain.fromWorldTerrain(),
    });
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";
    viewerRef.current = viewer;

    // 分级渲染监听
    const syncLayerVisibility = () => {
      const height = viewer.camera.positionCartographic.height;
      const isFar = height > FAR_VIEW_HEIGHT;
      if (wmsLayerRef.current) wmsLayerRef.current.show = isFar;
      const ds = viewer.dataSources.getByName("bird-results")[0];
      if (ds) ds.show = !isFar;
    };
    viewer.camera.moveEnd.addEventListener(syncLayerVisibility);
    syncLayerVisibility();

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id?.properties) {
        const p = picked.id.properties;
        alert(`物种: ${p.species?.getValue() || '未知'}\n地点: ${p.locality?.getValue() || '未知'}`);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      viewer.camera.moveEnd.removeEventListener(syncLayerVisibility);
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // 2. 月份联动：普通 FeatureType 使用 CQL_FILTER，切换月份时替换图层。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const previousLayer = wmsLayerRef.current;
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: GEOSERVER_WMS_URL,
      layers: "birdscope:occurrence_grid_monthly",
      parameters: {
        transparent: true,
        format: "image/png",
        CQL_FILTER: `year=2024 AND grid_size=1.0 AND month=${month ?? 10}`
      }
    });
    const nextLayer = viewer.imageryLayers.addImageryProvider(provider);
    nextLayer.show = viewer.camera.positionCartographic.height > FAR_VIEW_HEIGHT;
    wmsLayerRef.current = nextLayer;

    if (previousLayer && viewer.imageryLayers.contains(previousLayer)) {
      viewer.imageryLayers.remove(previousLayer, true);
    }

    return () => {
      if (!viewer.isDestroyed() && viewer.imageryLayers.contains(nextLayer)) {
        viewer.imageryLayers.remove(nextLayer, true);
      }
      if (wmsLayerRef.current === nextLayer) {
        wmsLayerRef.current = null;
      }
    };
  }, [month]);

  // 2b. 查询联动热力网格：执行查询后按 activeQuery(范围+物种) + 当前月份拉 /stats/grid，
  //     渲染为分级配色网格面，替代/叠加在全球 WMS 之上，反映"画的框 + 选的物种"。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const removeGrid = () => {
      if (gridDsRef.current && viewer.dataSources.contains(gridDsRef.current)) {
        viewer.dataSources.remove(gridDsRef.current, true);
      }
      gridDsRef.current = null;
    };

    if (!activeQuery) {
      removeGrid();
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    queryGrid({
      bbox: activeQuery.bbox,
      gridSize: pickGridSize(activeQuery.bbox),
      speciesKey: activeQuery.speciesKey,
      month: month ?? undefined,
      signal: controller.signal
    })
      .then((fc) => Cesium.GeoJsonDataSource.load(fc, { clampToGround: true })
        .then((ds) => {
          if (cancelled || viewer.isDestroyed()) return;
          ds.name = "bird-grid";
          ds.entities.values.forEach((ent, i) => {
            const count = fc.features[i]?.properties.record_count ?? 0;
            if (ent.polygon) {
              ent.polygon.material = new Cesium.ColorMaterialProperty(
                gridCellColor(count)
              );
              ent.polygon.outline = new Cesium.ConstantProperty(false);
            }
          });
          removeGrid();
          viewer.dataSources.add(ds);
          gridDsRef.current = ds;
        }))
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.warn("网格热力加载失败", err);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeQuery, month]);

  // 3. 交互绘图逻辑
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: any) => {
      const cartesian = viewer.scene.pickPosition(movement.position);
      if (!Cesium.defined(cartesian)) return;
      const lng = Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(cartesian).longitude);
      const lat = Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(cartesian).latitude);

      if (spatialMode === "bbox") {
        if (!drawStartPos.current) {
          drawStartPos.current = cartesian;
          viewer.entities.add({ id: "draw-start", position: cartesian, point: { color: Cesium.Color.RED, pixelSize: 10 } });
        } else {
          const s = Cesium.Cartographic.fromCartesian(drawStartPos.current);
          onBboxSelected([Math.min(Cesium.Math.toDegrees(s.longitude), lng), Math.min(Cesium.Math.toDegrees(s.latitude), lat), Math.max(Cesium.Math.toDegrees(s.longitude), lng), Math.max(Cesium.Math.toDegrees(s.latitude), lat)]);
          drawStartPos.current = null;
          viewer.entities.removeById("draw-start");
          viewer.entities.removeById("preview-rect");
        }
      }
      if (spatialMode === "buffer") onBufferCenterSelected({ lng, lat });
      if (spatialMode === "polygon") {
        polyPoints.current.push(cartesian);
        viewer.entities.add({ id: `tp-${polyPoints.current.length}`, position: cartesian, point: { color: Cesium.Color.YELLOW, pixelSize: 8 } });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((m: any) => {
      if (spatialMode === "polygon") {
        const cartesian = viewer.scene.pickPosition(m.position);
        if (Cesium.defined(cartesian)) polyPoints.current.push(cartesian);
        if (polyPoints.current.length >= 3) {
          const coords = polyPoints.current.map(p => {
            const c = Cesium.Cartographic.fromCartesian(p);
            return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
          });
          coords.push(coords[0]);
          onPolygonSelected({ type: "Polygon", coordinates: [coords as any] });
          polyPoints.current.forEach((_, i) => viewer.entities.removeById(`tp-${i+1}`));
          polyPoints.current = [];
        }
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => handler.destroy();
  }, [spatialMode, onBboxSelected, onPolygonSelected, onBufferCenterSelected]);

  // 4. 结果与范围展示
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let ds = viewer.dataSources.getByName("bird-results")[0] || new Cesium.CustomDataSource("bird-results");
    if (!viewer.dataSources.contains(ds)) viewer.dataSources.add(ds);
    ds.show = viewer.camera.positionCartographic.height <= FAR_VIEW_HEIGHT;
    ds.entities.removeAll();
    if (results) {
      results.features.forEach((f: any) => {
        ds.entities.add({
          position: Cesium.Cartesian3.fromDegrees(f.geometry.coordinates[0], f.geometry.coordinates[1]),
          point: { pixelSize: 8, color: Cesium.Color.fromCssColorString('#bef264'), outlineWidth: 1 },
          properties: f.properties,
        });
      });
    }

    viewer.entities.values.filter(e => e.id?.toString().startsWith('q-l-')).forEach(e => viewer.entities.remove(e));
    if (bbox && spatialMode === 'bbox') {
      viewer.entities.add({ id: 'q-l-bx', rectangle: { coordinates: Cesium.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]), material: Cesium.Color.TEAL.withAlpha(0.3), outline: true, outlineColor: Cesium.Color.TEAL } });
      viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]) });
    }
    if (polygon && spatialMode === 'polygon') {
      const ent = viewer.entities.add({ id: 'q-l-py', polygon: { hierarchy: Cesium.Cartesian3.fromDegreesArray(polygon.coordinates[0].flat()), material: Cesium.Color.LIME.withAlpha(0.3), outline: true, outlineColor: Cesium.Color.LIME } });
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(polygon.coordinates[0][0][0], polygon.coordinates[0][0][1], 500000) });
    }
    if (buffer && spatialMode === 'buffer') {
      viewer.entities.add({ id: 'q-l-bc', position: Cesium.Cartesian3.fromDegrees(buffer.lng, buffer.lat), point: { color: Cesium.Color.GOLD, pixelSize: 10 } });
      viewer.entities.add({ id: 'q-l-bi', position: Cesium.Cartesian3.fromDegrees(buffer.lng, buffer.lat), ellipse: { semiMinorAxis: (buffer.radiusKm || 50) * 1000, semiMajorAxis: (buffer.radiusKm || 50) * 1000, material: Cesium.Color.GOLD.withAlpha(0.2), outline: true, outlineColor: Cesium.Color.GOLD } });
    }
  }, [results, bbox, polygon, buffer, spatialMode]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#071c1b]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#092321] px-4 py-3 text-white">
        <div>
          <p className="section-kicker text-lime-200/80">Spatial Canvas</p>
          <h2 className="text-lg font-semibold tracking-tight">地图工作区</h2>
          <p className="mt-1 text-sm text-slate-300">全球 WMS 热力 · 局部观测点 · 空间绘制</p>
        </div>
        <ModeBadge mode={spatialMode} />
      </div>

      <div className="relative flex flex-1 overflow-hidden bg-[#071c1b]">
        <div ref={containerRef} className="absolute inset-0 h-full w-full cursor-crosshair" />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />

        <div className="absolute left-4 top-4 grid max-w-[calc(100%-2rem)] gap-2 text-xs text-slate-200">
          <MapBadge icon={Crosshair} title="Cesium Engine" detail="WGS-84 · Zoom Adaptive" />
          <div className="hidden sm:block">
            <MapBadge icon={Layers3} title="Layer Stack" detail="WMS Heatmap · Observation" />
          </div>
          <SelectionSummary bbox={bbox} buffer={buffer} polygon={polygon} />
        </div>

        <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded-md border border-white/15 bg-[#061719]/90 p-3 text-sm text-slate-200 shadow-2xl shadow-black/25 backdrop-blur">
          <div className="grid gap-2 sm:grid-cols-3">
            <button className="map-action border-teal-300/30 bg-teal-300/10" onClick={() => onBboxSelected(SAMPLE_BBOX)} type="button"><Square className="h-4 w-4" /> 中国范围</button>
            <button className="map-action border-lime-300/30 bg-lime-300/10" onClick={() => onPolygonSelected(SAMPLE_POLYGON)} type="button"><Pentagon className="h-4 w-4" /> 北京样例</button>
            <button className="map-action border-amber-300/30 bg-amber-300/10" onClick={() => onBufferCenterSelected(SAMPLE_BUFFER_CENTER)} type="button"><CircleDot className="h-4 w-4" /> 上海中心</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectionSummary({ bbox, polygon, buffer }: any) {
  if (bbox) return <SummaryText label="当前矩形" value={bbox.map((n:any) => n?.toFixed?.(2) || '0').join(", ")} tone="teal" />;
  if (polygon) return <SummaryText label="当前多边形" tone="lime" value={`${polygon.coordinates?.[0]?.length || 0} 点`} />;
  if (buffer) return <SummaryText label="当前缓冲区" tone="amber" value={`${buffer.lng?.toFixed?.(4) || '0.00'}, ${buffer.lat?.toFixed?.(4) || '0.00'}`} />;
  return <SummaryText label="当前选择" tone="slate" value="尚未选择范围" />;
}
function ModeBadge({ mode }: { mode: SpatialMode }) {
  const label = mode === "bbox" ? "矩形框选" : mode === "polygon" ? "多边形" : "缓冲区";
  return <span className="inline-flex items-center gap-1.5 rounded-md border border-lime-200/20 bg-lime-200/10 px-2.5 py-1.5 text-xs font-semibold text-lime-100"><MapPin className="h-3.5 w-3.5" /> {label}</span>;
}
function MapBadge({ icon: Icon, title, detail }: any) {
  return <div className="rounded-md border border-white/15 bg-[#061719]/85 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur"><div className="flex items-center gap-2 font-semibold text-white"><Icon className="h-3.5 w-3.5 text-teal-300" /> {title}</div><p className="mt-1 text-slate-400">{detail}</p></div>;
}
function SummaryText({ label, value, tone }: any) {
  const toneClass = tone === "teal" ? "border-teal-300/25 bg-teal-300/10" : tone === "lime" ? "border-lime-300/25 bg-lime-300/10" : tone === "amber" ? "border-amber-300/25 bg-amber-300/10" : "border-white/15 bg-[#061719]/80";
  return <div className={`inline-flex max-w-full items-center rounded-md border px-3 py-2 text-xs shadow-xl shadow-black/20 backdrop-blur ${toneClass}`}><span className="shrink-0 font-medium text-slate-300">{label}</span><span className="ml-2 truncate font-semibold text-white">{value}</span></div>;
}

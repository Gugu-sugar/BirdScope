import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useEffect, useRef } from "react"; 
import { useQueryStore } from "../../store/queryStore";

import {
  CircleDot, Crosshair, Layers3, MapPin, Pentagon, Ruler, Square
} from "lucide-react";
import type {
  Bbox, BufferSelection, GeoJsonPolygon, LngLat, SpatialMode
} from "../../types/geo";

type MapPanelProps = {
  spatialMode: SpatialMode;
  bbox: Bbox | null;
  polygon: GeoJsonPolygon | null;
  buffer: BufferSelection | null;
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
  spatialMode, bbox, polygon, buffer, onBboxSelected, onPolygonSelected, onBufferCenterSelected
}: MapPanelProps) {
  
  const { results, month } = useQueryStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const drawStartPos = useRef<Cesium.Cartesian3 | null>(null);
  const polyPoints = useRef<Cesium.Cartesian3[]>([]);
  const wmsLayerRef = useRef<Cesium.ImageryLayer | null>(null);

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

    // 接入 WMS
    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: "http://localhost:8080/geoserver/birdscope/wms",
      layers: "birdscope:occurrence_grid_monthly",
      parameters: { transparent: true, format: "image/png", viewparams: `month:${month || 10}` },
    });
    wmsLayerRef.current = viewer.imageryLayers.addImageryProvider(wmsProvider);

    // 分级渲染监听
    viewer.camera.moveEnd.addEventListener(() => {
      const height = viewer.camera.positionCartographic.height;
      const isFar = height > 2500000; 
      if (wmsLayerRef.current) wmsLayerRef.current.show = isFar;
      const ds = viewer.dataSources.getByName("bird-results")[0];
      if (ds) ds.show = !isFar;
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id?.properties) {
        const p = picked.id.properties;
        alert(`物种: ${p.species?.getValue() || '未知'}\n地点: ${p.locality?.getValue() || '未知'}`);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // 2. 月份联动 - 【修复报错的关键位置】
  useEffect(() => {
    if (!viewerRef.current || !wmsLayerRef.current) return;
    
    const provider = wmsLayerRef.current.imageryProvider as any; // 强制转为 any 避开检查
    if (provider && provider._parameters) {
      // 动态修改隐藏的 viewparams 属性
      provider._parameters.viewparams = `month:${month}`;
      
      // 强制刷新图层（使用更兼容的刷新方式）
      const layer = wmsLayerRef.current;
      layer.show = false;
      setTimeout(() => { layer.show = viewerRef.current!.camera.positionCartographic.height > 2500000; }, 10);
    }
  }, [month]);

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
    <div className="flex h-full min-h-[560px] flex-col bg-[#071c1b]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#092321] px-4 py-3 text-white">
        <div>
          <p className="section-kicker text-lime-200/80">Spatial Canvas</p>
          <h2 className="text-lg font-semibold tracking-tight">地图工作区</h2>
          <p className="mt-1 text-sm text-slate-300">Cesium 主场景已接入 · 支持全模式交互</p>
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
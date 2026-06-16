import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  Compass,
  Crosshair,
  Layers3,
  MapPin,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef } from "react";
import { queryGrid } from "../../api/stats";
import {
  type ActiveQuery,
  type BasemapKey,
  type GridSize,
  type LayerVisibility,
  useQueryStore
} from "../../store/queryStore";
import type {
  Bbox,
  BufferSelection,
  GeoJsonPolygon,
  LngLat,
  SpatialMode
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

const GEOSERVER_WMS_URL =
  import.meta.env.VITE_GEOSERVER_WMS_URL ??
  "http://localhost:8080/geoserver/birdscope/wms";
const DEFAULT_VIEW_BBOX: Bbox = [70, 15, 140, 55];
const TOP_DOWN_ORIENTATION = {
  heading: 0,
  pitch: Cesium.Math.toRadians(-90),
  roll: 0
};

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

type CameraFocusInput = {
  spatialMode: SpatialMode;
  bbox: Bbox | null;
  polygon: GeoJsonPolygon | null;
  buffer: BufferSelection | null;
  activeQuery: ActiveQuery | null;
};

type SummaryTone = "teal" | "lime" | "amber" | "slate";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rectangleFromBbox(bbox: Bbox) {
  const [minx, miny, maxx, maxy] = bbox;
  return Cesium.Rectangle.fromDegrees(
    clamp(Math.min(minx, maxx), -180, 180),
    clamp(Math.min(miny, maxy), -89, 89),
    clamp(Math.max(minx, maxx), -180, 180),
    clamp(Math.max(miny, maxy), -89, 89)
  );
}

function rectangleFromPolygon(polygon: GeoJsonPolygon) {
  const ring = polygon.coordinates[0] ?? [];
  if (ring.length === 0) {
    return rectangleFromBbox(DEFAULT_VIEW_BBOX);
  }

  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  const pad = 0.25;
  return Cesium.Rectangle.fromDegrees(
    clamp(Math.min(...lngs) - pad, -180, 180),
    clamp(Math.min(...lats) - pad, -89, 89),
    clamp(Math.max(...lngs) + pad, -180, 180),
    clamp(Math.max(...lats) + pad, -89, 89)
  );
}

function rectangleFromBuffer(buffer: BufferSelection) {
  const latDelta = Math.max(buffer.radiusKm / 111, 0.25);
  const lngDelta = Math.max(
    buffer.radiusKm /
      (111 * Math.max(Math.cos(Cesium.Math.toRadians(buffer.lat)), 0.2)),
    0.25
  );

  return Cesium.Rectangle.fromDegrees(
    clamp(buffer.lng - lngDelta, -180, 180),
    clamp(buffer.lat - latDelta, -89, 89),
    clamp(buffer.lng + lngDelta, -180, 180),
    clamp(buffer.lat + latDelta, -89, 89)
  );
}

function focusRectangle({
  spatialMode,
  bbox,
  polygon,
  buffer,
  activeQuery
}: CameraFocusInput) {
  if (spatialMode === "bbox" && bbox) {
    return rectangleFromBbox(bbox);
  }
  if (spatialMode === "polygon" && polygon) {
    return rectangleFromPolygon(polygon);
  }
  if (spatialMode === "buffer" && buffer) {
    return rectangleFromBuffer(buffer);
  }
  if (activeQuery) {
    return rectangleFromBbox(activeQuery.bbox);
  }
  return rectangleFromBbox(DEFAULT_VIEW_BBOX);
}

export function MapPanel({
  spatialMode,
  bbox,
  polygon,
  buffer,
  activeQuery,
  onBboxSelected,
  onPolygonSelected,
  onBufferCenterSelected
}: MapPanelProps) {
  const { basemap, gridSize, layerVisibility, month, results } =
    useQueryStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const baseLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const drawStartPos = useRef<Cesium.Cartesian3 | null>(null);
  const polyPoints = useRef<Cesium.Cartesian3[]>([]);
  const wmsLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const gridDsRef = useRef<Cesium.GeoJsonDataSource | null>(null);

  // 1. 初始化地图。侧栏开合会改变容器尺寸，ResizeObserver 必须同步触发 viewer.resize()。
  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewerRef.current) return;

    const viewer = new Cesium.Viewer(container, {
      animation: false,
      timeline: false,
      fullscreenButton: false,
      baseLayerPicker: false,
      infoBox: false,
      selectionIndicator: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      terrain: Cesium.Terrain.fromWorldTerrain()
    });
    viewer.imageryLayers.removeAll();
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";

    const toolbar = viewer.container.querySelector(
      ".cesium-viewer-toolbar"
    ) as HTMLElement | null;
    if (toolbar) {
      toolbar.style.display = "none";
    }

    viewerRef.current = viewer;

    const resizeObserver = new ResizeObserver(() => {
      if (!viewer.isDestroyed()) {
        viewer.resize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
      baseLayerRef.current = null;
      wmsLayerRef.current = null;
      gridDsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (
      baseLayerRef.current &&
      viewer.imageryLayers.contains(baseLayerRef.current)
    ) {
      viewer.imageryLayers.remove(baseLayerRef.current, true);
      baseLayerRef.current = null;
    }

    baseLayerRef.current = viewer.imageryLayers.addImageryProvider(
      createBasemapProvider(basemap),
      0
    );
  }, [basemap]);

  // 2. GeoServer 月度聚合图层。occurrence_grid_monthly 没有物种维度，CQL 只拼 grid_size/year/month。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (
      wmsLayerRef.current &&
      viewer.imageryLayers.contains(wmsLayerRef.current)
    ) {
      viewer.imageryLayers.remove(wmsLayerRef.current, true);
      wmsLayerRef.current = null;
    }

    const provider = new Cesium.WebMapServiceImageryProvider({
      url: GEOSERVER_WMS_URL,
      layers: "birdscope:occurrence_grid_monthly",
      parameters: {
        transparent: "true",
        format: "image/png",
        tiled: "true",
        CQL_FILTER: buildWmsCqlFilter(gridSize, month ?? 10)
      }
    });
    const layer = viewer.imageryLayers.addImageryProvider(provider);
    layer.show = layerVisibility.globalWms;
    wmsLayerRef.current = layer;

    return () => {
      if (!viewer.isDestroyed() && viewer.imageryLayers.contains(layer)) {
        viewer.imageryLayers.remove(layer, true);
      }
      if (wmsLayerRef.current === layer) {
        wmsLayerRef.current = null;
      }
    };
  }, [gridSize, layerVisibility.globalWms, month]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const points = viewer.dataSources.getByName("bird-results")[0];
    if (points) {
      points.show = layerVisibility.points;
    }
  }, [layerVisibility.points]);

  // 2b. 查询联动热力网格：范围/物种来自 activeQuery，月份和网格粒度跟随当前 store。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const removeGrid = () => {
      if (gridDsRef.current && viewer.dataSources.contains(gridDsRef.current)) {
        viewer.dataSources.remove(gridDsRef.current, true);
      }
      gridDsRef.current = null;
    };

    if (!layerVisibility.grid) {
      if (gridDsRef.current) {
        gridDsRef.current.show = false;
      }
      return;
    }

    if (!activeQuery) {
      removeGrid();
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    queryGrid({
      bbox: activeQuery.bbox,
      gridSize,
      speciesKey: activeQuery.speciesKey,
      month: month ?? undefined,
      signal: controller.signal
    })
      .then((fc) =>
        Cesium.GeoJsonDataSource.load(fc, { clampToGround: true }).then((ds) => {
          if (cancelled || viewer.isDestroyed()) return;
          ds.name = "bird-grid";
          ds.show = layerVisibility.grid;
          ds.entities.values.forEach((entity, index) => {
            const count = fc.features[index]?.properties.record_count ?? 0;
            if (entity.polygon) {
              entity.polygon.material = new Cesium.ColorMaterialProperty(
                gridCellColor(count)
              );
              entity.polygon.outline = new Cesium.ConstantProperty(false);
            }
          });
          removeGrid();
          viewer.dataSources.add(ds);
          gridDsRef.current = ds;
        })
      )
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn("网格热力加载失败", error);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeQuery, gridSize, layerVisibility.grid, month]);

  // 3. 交互绘图与点位拾取。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id?.properties) {
        const properties = picked.id.properties;
        alert(
          `物种: ${properties.species?.getValue() || "未知"}\n地点: ${
            properties.locality?.getValue() || "未知"
          }`
        );
        return;
      }

      const cartesian = pickCartesian(viewer, movement.position);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lng = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);

      if (spatialMode === "bbox") {
        if (!drawStartPos.current) {
          drawStartPos.current = cartesian;
          viewer.entities.add({
            id: "draw-start",
            position: cartesian,
            point: { color: Cesium.Color.RED, pixelSize: 10 }
          });
        } else {
          const start = Cesium.Cartographic.fromCartesian(drawStartPos.current);
          onBboxSelected([
            Math.min(Cesium.Math.toDegrees(start.longitude), lng),
            Math.min(Cesium.Math.toDegrees(start.latitude), lat),
            Math.max(Cesium.Math.toDegrees(start.longitude), lng),
            Math.max(Cesium.Math.toDegrees(start.latitude), lat)
          ]);
          drawStartPos.current = null;
          viewer.entities.removeById("draw-start");
          viewer.entities.removeById("preview-rect");
        }
      }

      if (spatialMode === "buffer") {
        onBufferCenterSelected({ lng, lat });
      }

      if (spatialMode === "polygon") {
        polyPoints.current.push(cartesian);
        viewer.entities.add({
          id: `tp-${polyPoints.current.length}`,
          position: cartesian,
          point: { color: Cesium.Color.YELLOW, pixelSize: 8 }
        });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (spatialMode !== "polygon") return;

      const cartesian = pickCartesian(viewer, movement.position);
      if (cartesian) {
        polyPoints.current.push(cartesian);
      }
      if (polyPoints.current.length < 3) return;

      const coords = polyPoints.current.map((point) => {
        const cartographic = Cesium.Cartographic.fromCartesian(point);
        return [
          Cesium.Math.toDegrees(cartographic.longitude),
          Cesium.Math.toDegrees(cartographic.latitude)
        ];
      });
      coords.push(coords[0]);
      onPolygonSelected({ type: "Polygon", coordinates: [coords as any] });
      polyPoints.current.forEach((_, index) =>
        viewer.entities.removeById(`tp-${index + 1}`)
      );
      polyPoints.current = [];
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => handler.destroy();
  }, [
    onBboxSelected,
    onBufferCenterSelected,
    onPolygonSelected,
    spatialMode
  ]);

  // 4. 查询结果点位。点位 ID 保持 pt-${gbif_id}，便于后续选中态联动。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const ds = getOrCreateDataSource(viewer, "bird-results");
    ds.entities.removeAll();
    ds.show = layerVisibility.points;

    results?.features.forEach((feature) => {
      ds.entities.add({
        id: `pt-${feature.properties.gbif_id}`,
        position: Cesium.Cartesian3.fromDegrees(
          feature.geometry.coordinates[0],
          feature.geometry.coordinates[1]
        ),
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString("#bef264"),
          outlineColor: Cesium.Color.fromCssColorString("#064e3b"),
          outlineWidth: 1
        },
        properties: feature.properties
      });
    });
  }, [layerVisibility.points, results]);

  // 5. 当前空间选择范围展示和视角聚焦。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.entities.values
      .filter((entity) => entity.id?.toString().startsWith("q-l-"))
      .forEach((entity) => viewer.entities.remove(entity));

    if (bbox && spatialMode === "bbox") {
      viewer.entities.add({
        id: "q-l-bx",
        rectangle: {
          coordinates: rectangleFromBbox(bbox),
          material: Cesium.Color.TEAL.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.TEAL
        }
      });
      viewer.camera.flyTo({
        destination: rectangleFromBbox(bbox),
        orientation: TOP_DOWN_ORIENTATION
      });
    }

    if (polygon && spatialMode === "polygon") {
      viewer.entities.add({
        id: "q-l-py",
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray(
            polygon.coordinates[0].flat()
          ),
          material: Cesium.Color.LIME.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.LIME
        }
      });
      viewer.camera.flyTo({
        destination: rectangleFromPolygon(polygon),
        orientation: TOP_DOWN_ORIENTATION
      });
    }

    if (buffer && spatialMode === "buffer") {
      viewer.entities.add({
        id: "q-l-bc",
        position: Cesium.Cartesian3.fromDegrees(buffer.lng, buffer.lat),
        point: { color: Cesium.Color.GOLD, pixelSize: 10 }
      });
      viewer.entities.add({
        id: "q-l-bi",
        position: Cesium.Cartesian3.fromDegrees(buffer.lng, buffer.lat),
        ellipse: {
          semiMinorAxis: (buffer.radiusKm || 50) * 1000,
          semiMajorAxis: (buffer.radiusKm || 50) * 1000,
          material: Cesium.Color.GOLD.withAlpha(0.2),
          outline: true,
          outlineColor: Cesium.Color.GOLD
        }
      });
      viewer.camera.flyTo({
        destination: rectangleFromBuffer(buffer),
        orientation: TOP_DOWN_ORIENTATION
      });
    }
  }, [bbox, buffer, polygon, spatialMode]);

  const resetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.resize();
    viewer.camera.flyTo({
      destination: focusRectangle({
        activeQuery,
        bbox,
        buffer,
        polygon,
        spatialMode
      }),
      duration: 0.8,
      orientation: TOP_DOWN_ORIENTATION
    });
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#071c1b]">
      <div
        className="absolute inset-0 h-full w-full cursor-crosshair"
        ref={containerRef}
      />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />

      <div className="absolute left-4 top-4 z-10 grid max-w-[min(30rem,calc(100%-23rem))] gap-2 text-xs text-slate-200">
        <ModeBadge mode={spatialMode} />
        <MapBadge
          detail={`${basemapLabel(basemap)} · ${formatGridSize(gridSize)}° grid`}
          icon={Crosshair}
          title="Cesium Engine"
        />
        <div className="hidden sm:block">
          <MapBadge
            detail={layerStackLabel(layerVisibility)}
            icon={Layers3}
            title="Layer Stack"
          />
        </div>
        <SelectionSummary bbox={bbox} buffer={buffer} polygon={polygon} />
      </div>

      <button
        aria-label="回正地图视角"
        className="absolute bottom-4 right-4 z-20 inline-flex h-11 items-center gap-2 rounded-md border border-lime-200/20 bg-[#061719]/90 px-3 text-xs font-semibold text-lime-100 shadow-2xl shadow-black/25 backdrop-blur transition hover:border-lime-200/40 hover:bg-lime-200/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-lime-200/60"
        onClick={resetCamera}
        title="回到当前范围并恢复俯视视角"
        type="button"
      >
        <Compass className="h-4 w-4" />
        回正
      </button>
    </div>
  );
}

function createBasemapProvider(basemap: BasemapKey) {
  if (basemap === "imagery") {
    return new Cesium.UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      credit: "Tiles Esri"
    });
  }

  if (basemap === "terrain") {
    return new Cesium.UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      credit: "Tiles Esri"
    });
  }

  return new Cesium.UrlTemplateImageryProvider({
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maximumLevel: 19,
    credit: "OpenStreetMap contributors"
  });
}

function buildWmsCqlFilter(gridSize: GridSize, month: number) {
  return `grid_size=${formatGridSize(gridSize)} AND year=2024 AND month=${month}`;
}

function formatGridSize(gridSize: GridSize) {
  return gridSize === 1 ? "1.0" : "0.5";
}

function pickCartesian(viewer: Cesium.Viewer, position: Cesium.Cartesian2) {
  const picked = viewer.scene.pickPosition(position);
  if (Cesium.defined(picked)) return picked;
  return viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
}

function getOrCreateDataSource(viewer: Cesium.Viewer, name: string) {
  const existing = viewer.dataSources.getByName(name)[0];
  if (existing) return existing as Cesium.CustomDataSource;
  const ds = new Cesium.CustomDataSource(name);
  viewer.dataSources.add(ds);
  return ds;
}

function basemapLabel(basemap: BasemapKey) {
  if (basemap === "imagery") return "影像";
  if (basemap === "terrain") return "地形";
  return "街道";
}

function layerStackLabel(layerVisibility: LayerVisibility) {
  const visibleLayers = [
    layerVisibility.points ? "点位" : null,
    layerVisibility.grid ? "网格" : null,
    layerVisibility.globalWms ? "WMS" : null
  ].filter(Boolean);
  return visibleLayers.length > 0 ? visibleLayers.join(" · ") : "暂无可见图层";
}

function SelectionSummary({
  bbox,
  polygon,
  buffer
}: {
  bbox: Bbox | null;
  polygon: GeoJsonPolygon | null;
  buffer: BufferSelection | null;
}) {
  if (bbox) {
    return (
      <SummaryText
        label="当前矩形"
        tone="teal"
        value={bbox.map((value) => value.toFixed(2)).join(", ")}
      />
    );
  }
  if (polygon) {
    return (
      <SummaryText
        label="当前多边形"
        tone="lime"
        value={`${polygon.coordinates[0]?.length ?? 0} 点`}
      />
    );
  }
  if (buffer) {
    return (
      <SummaryText
        label="当前缓冲区"
        tone="amber"
        value={`${buffer.lng.toFixed(4)}, ${buffer.lat.toFixed(4)}`}
      />
    );
  }
  return <SummaryText label="当前选择" tone="slate" value="尚未选择范围" />;
}

function ModeBadge({ mode }: { mode: SpatialMode }) {
  const label =
    mode === "bbox" ? "矩形框选" : mode === "polygon" ? "多边形" : "缓冲区";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-lime-200/20 bg-lime-200/10 px-2.5 py-1.5 text-xs font-semibold text-lime-100">
      <MapPin className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function MapBadge({
  icon: Icon,
  title,
  detail
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-white/15 bg-[#061719]/85 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur">
      <div className="flex items-center gap-2 font-semibold text-white">
        <Icon className="h-3.5 w-3.5 text-teal-300" /> {title}
      </div>
      <p className="mt-1 text-slate-400">{detail}</p>
    </div>
  );
}

function SummaryText({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: SummaryTone;
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-300/25 bg-teal-300/10"
      : tone === "lime"
        ? "border-lime-300/25 bg-lime-300/10"
        : tone === "amber"
          ? "border-amber-300/25 bg-amber-300/10"
          : "border-white/15 bg-[#061719]/80";
  return (
    <div
      className={`inline-flex max-w-full items-center rounded-md border px-3 py-2 text-xs shadow-xl shadow-black/20 backdrop-blur ${toneClass}`}
    >
      <span className="shrink-0 font-medium text-slate-300">{label}</span>
      <span className="ml-2 truncate font-semibold text-white">{value}</span>
    </div>
  );
}

import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { queryGrid } from "../../api/stats";
import type { ActiveQuery } from "../../store/queryStore";
import {
  type BasemapKey,
  type GridSize,
  useQueryStore
} from "../../store/queryStore";

import { Compass, MapPin, MousePointer2, X } from "lucide-react";
import type { OccurrenceFeature } from "../../types/api";
import type {
  Bbox,
  BufferSelection,
  GeoJsonPolygon,
  LngLat,
  SpatialMode
} from "../../types/geo";

type PopupPosition = {
  left: number;
  top: number;
  visible: boolean;
};

type DrawingState = {
  bboxStarted: boolean;
  polygonPoints: number;
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

const GEOSERVER_WMS_URL =
  import.meta.env.VITE_GEOSERVER_WMS_URL ??
  "http://localhost:8080/geoserver/birdscope/wms";
const FAR_VIEW_HEIGHT = 2_500_000;
const DEFAULT_VIEW_BBOX: Bbox = [70, 15, 140, 55];
const TOP_DOWN_ORIENTATION = {
  heading: 0,
  pitch: Cesium.Math.toRadians(-90),
  roll: 0
};

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

function occurrenceLabel(feature: OccurrenceFeature) {
  return (
    feature.properties.species ??
    feature.properties.scientific_name ??
    "未命名物种"
  );
}

function resultPointStyle(isSelected: boolean) {
  return {
    pixelSize: isSelected ? 15 : 8,
    color: isSelected
      ? Cesium.Color.fromCssColorString("#f59e0b")
      : Cesium.Color.fromCssColorString("#bef264"),
    outlineColor: isSelected
      ? Cesium.Color.WHITE
      : Cesium.Color.fromCssColorString("#1f2937"),
    outlineWidth: isSelected ? 3 : 1,
    disableDepthTestDistance: Number.POSITIVE_INFINITY
  };
}

function pickedResultGbifId(picked: unknown) {
  const entity = (picked as { id?: Cesium.Entity } | undefined)?.id;
  if (!entity?.properties) return null;

  const entityId = typeof entity.id === "string" ? entity.id : "";
  if (!entityId.startsWith("pt-")) return null;

  const propertyValue = entity.properties.getValue(Cesium.JulianDate.now())
    ?.gbif_id;
  const gbifId =
    typeof propertyValue === "number" ? propertyValue : Number(entityId.slice(3));
  return Number.isFinite(gbifId) ? gbifId : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function cartesianToLngLat(cartesian: Cesium.Cartesian3) {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  return {
    lng: Cesium.Math.toDegrees(cartographic.longitude),
    lat: Cesium.Math.toDegrees(cartographic.latitude)
  };
}

function bboxFromCartesians(start: Cesium.Cartesian3, end: Cesium.Cartesian3): Bbox {
  const a = cartesianToLngLat(start);
  const b = cartesianToLngLat(end);
  return [
    Math.min(a.lng, b.lng),
    Math.min(a.lat, b.lat),
    Math.max(a.lng, b.lng),
    Math.max(a.lat, b.lat)
  ];
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

function removeDrawingScratch(viewer: Cesium.Viewer) {
  viewer.entities.removeById("draw-start");
  viewer.entities.removeById("preview-rect");
  viewer.entities.values
    .filter((entity) => entity.id?.toString().startsWith("tp-"))
    .forEach((entity) => viewer.entities.remove(entity));
}

function updatePreviewRectangle(
  viewer: Cesium.Viewer,
  start: Cesium.Cartesian3,
  end: Cesium.Cartesian3
) {
  const rectangle = rectangleFromBbox(bboxFromCartesians(start, end));
  const existing = viewer.entities.getById("preview-rect");

  if (existing?.rectangle) {
    existing.rectangle.coordinates = new Cesium.ConstantProperty(rectangle);
    return;
  }

  viewer.entities.add({
    id: "preview-rect",
    rectangle: {
      coordinates: rectangle,
      material: Cesium.Color.TEAL.withAlpha(0.16),
      outline: true,
      outlineColor: Cesium.Color.CYAN
    }
  });
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
  const {
    basemap,
    gridSize,
    layerVisibility,
    month,
    results,
    selectedGbifId,
    setSelectedGbifId
  } = useQueryStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const baseLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  // 天地图注记层：单独持有，始终置于热力图之上，保证地名不被热力图遮盖。
  const labelLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const drawStartPos = useRef<Cesium.Cartesian3 | null>(null);
  const polyPoints = useRef<Cesium.Cartesian3[]>([]);
  const wmsLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const gridDsRef = useRef<Cesium.GeoJsonDataSource | null>(null);
  const layerVisibilityRef = useRef(layerVisibility);
  const syncLayerVisibilityRef = useRef<(() => void) | null>(null);
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    bboxStarted: false,
    polygonPoints: 0
  });
  const selectedFeature = useMemo(
    () =>
      selectedGbifId === null
        ? null
        : results?.features.find(
            (feature) => feature.properties.gbif_id === selectedGbifId
          ) ?? null,
    [results, selectedGbifId]
  );

  useEffect(() => {
    layerVisibilityRef.current = layerVisibility;
    syncLayerVisibilityRef.current?.();
    if (gridDsRef.current) {
      gridDsRef.current.show = layerVisibility.grid;
    }
  }, [layerVisibility]);

  useEffect(() => {
    const viewer = viewerRef.current;
    drawStartPos.current = null;
    polyPoints.current = [];
    setDrawingState({ bboxStarted: false, polygonPoints: 0 });
    if (viewer && !viewer.isDestroyed()) {
      removeDrawingScratch(viewer);
    }
  }, [spatialMode]);

  // 1. 初始化地图
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

    const syncLayerVisibility = () => {
      const height = viewer.camera.positionCartographic.height;
      const isFar = height > FAR_VIEW_HEIGHT;
      const visibility = layerVisibilityRef.current;
      if (wmsLayerRef.current) {
        wmsLayerRef.current.show = visibility.globalWms && isFar;
      }
      const pointDs = viewer.dataSources.getByName("bird-results")[0];
      if (pointDs) {
        // 结果点位（封顶 800、已聚合）任意层级都可显示，便于全球范围查询时也能看到结果。
        pointDs.show = visibility.points;
      }
      if (gridDsRef.current) {
        gridDsRef.current.show = visibility.grid;
      }
    };
    syncLayerVisibilityRef.current = syncLayerVisibility;
    viewer.camera.moveEnd.addEventListener(syncLayerVisibility);
    syncLayerVisibility();

    const resizeObserver = new ResizeObserver(() => {
      if (!viewer.isDestroyed()) {
        viewer.resize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      syncLayerVisibilityRef.current = null;
      resizeObserver.disconnect();
      viewer.camera.moveEnd.removeEventListener(syncLayerVisibility);
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (baseLayerRef.current) {
      viewer.imageryLayers.remove(baseLayerRef.current, false);
      baseLayerRef.current = null;
    }
    if (labelLayerRef.current) {
      viewer.imageryLayers.remove(labelLayerRef.current, false);
      labelLayerRef.current = null;
    }

    const { base, label } = createBasemapProviders(basemap);
    // 底图置于最底层；注记后加并提到最顶，使其盖在 WMS 热力图之上。
    baseLayerRef.current = viewer.imageryLayers.addImageryProvider(base, 0);
    labelLayerRef.current = viewer.imageryLayers.addImageryProvider(label);
    viewer.imageryLayers.raiseToTop(labelLayerRef.current);
  }, [basemap]);

  // 2. 月份 / 网格粒度联动：普通 FeatureType 使用 CQL_FILTER，切换时替换图层。
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
        tiled: true,
        CQL_FILTER: buildWmsCqlFilter(gridSize, month ?? 10)
      }
    });
    const nextLayer = viewer.imageryLayers.addImageryProvider(provider);
    wmsLayerRef.current = nextLayer;
    // WMS 加在顶部后，把天地图注记重新提到最顶，确保地名盖在热力图之上。
    if (labelLayerRef.current && viewer.imageryLayers.contains(labelLayerRef.current)) {
      viewer.imageryLayers.raiseToTop(labelLayerRef.current);
    }
    syncLayerVisibilityRef.current?.();

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
  }, [gridSize, month]);

  // 2b. 查询联动热力网格：执行查询后按 activeQuery + 当前月份拉 /stats/grid。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const removeGrid = () => {
      if (gridDsRef.current && viewer.dataSources.contains(gridDsRef.current)) {
        viewer.dataSources.remove(gridDsRef.current, true);
      }
      gridDsRef.current = null;
    };

    if (!activeQuery || !layerVisibility.grid) {
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
          ds.show = layerVisibilityRef.current.grid;
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

  // 3. 交互绘图与结果点选中。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: any) => {
      const pickedGbifId = pickedResultGbifId(
        viewer.scene.pick(movement.position)
      );
      if (pickedGbifId !== null) {
        setSelectedGbifId(pickedGbifId);
        return;
      }

      const cartesian = pickCartesian(viewer, movement.position);
      if (!cartesian) return;
      const lng = Cesium.Math.toDegrees(
        Cesium.Cartographic.fromCartesian(cartesian).longitude
      );
      const lat = Cesium.Math.toDegrees(
        Cesium.Cartographic.fromCartesian(cartesian).latitude
      );

      if (spatialMode === "bbox") {
        if (!drawStartPos.current) {
          drawStartPos.current = cartesian;
          setDrawingState({ bboxStarted: true, polygonPoints: 0 });
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
          setDrawingState({ bboxStarted: false, polygonPoints: 0 });
          viewer.entities.removeById("draw-start");
          viewer.entities.removeById("preview-rect");
        }
      }

      if (spatialMode === "buffer") {
        onBufferCenterSelected({ lng, lat });
      }

      if (spatialMode === "polygon") {
        polyPoints.current.push(cartesian);
        setDrawingState({
          bboxStarted: false,
          polygonPoints: polyPoints.current.length
        });
        viewer.entities.add({
          id: `tp-${polyPoints.current.length}`,
          position: cartesian,
          point: { color: Cesium.Color.YELLOW, pixelSize: 8 }
        });
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((movement: any) => {
      if (spatialMode === "bbox" && drawStartPos.current) {
        const cartesian = pickCartesian(viewer, movement.endPosition);
        if (cartesian) {
          updatePreviewRectangle(viewer, drawStartPos.current, cartesian);
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      if (spatialMode !== "polygon") return;
      if (polyPoints.current.length < 3) return;

      const coords = polyPoints.current.map((point) => {
        const { lng, lat } = cartesianToLngLat(point);
        return [lng, lat];
      });
      coords.push(coords[0]);
      onPolygonSelected({ type: "Polygon", coordinates: [coords as any] });
      polyPoints.current.forEach((_, index) =>
        viewer.entities.removeById(`tp-${index + 1}`)
      );
      polyPoints.current = [];
      setDrawingState({ bboxStarted: false, polygonPoints: 0 });
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => handler.destroy();
  }, [
    onBboxSelected,
    onBufferCenterSelected,
    onPolygonSelected,
    setSelectedGbifId,
    spatialMode
  ]);

  // 4. 查询结果点位展示。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const ds = getOrCreateDataSource(viewer, "bird-results");
    ds.entities.removeAll();

    if (results) {
      results.features.forEach((feature) => {
        const gbifId = feature.properties.gbif_id;
        ds.entities.add({
          id: `pt-${gbifId}`,
          position: Cesium.Cartesian3.fromDegrees(
            feature.geometry.coordinates[0],
            feature.geometry.coordinates[1]
          ),
          point: resultPointStyle(gbifId === selectedGbifId),
          properties: feature.properties
        });
      });
    }

    syncLayerVisibilityRef.current?.();
  }, [results, selectedGbifId]);

  // 5. 查询范围展示。
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

  // 6. 选中点位：列表或地图点选都会飞到目标点。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedFeature) return;

    const [lng, lat] = selectedFeature.geometry.coordinates;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, 180_000),
      duration: 0.8,
      orientation: TOP_DOWN_ORIENTATION
    });
  }, [selectedFeature]);

  // 7. 页面气泡跟随选中点位。
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedFeature) {
      setPopupPosition(null);
      return;
    }

    const [lng, lat] = selectedFeature.geometry.coordinates;
    const worldPosition = Cesium.Cartesian3.fromDegrees(lng, lat);

    const updatePopupPosition = () => {
      const container = containerRef.current;
      if (!container || viewer.isDestroyed()) return;

      const windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
        viewer.scene,
        worldPosition
      );

      if (!Cesium.defined(windowPosition)) {
        setPopupPosition((previous) =>
          previous?.visible === false
            ? previous
            : { left: 0, top: 0, visible: false }
        );
        return;
      }

      const left = Math.round(windowPosition.x);
      const top = Math.round(windowPosition.y);
      const visible =
        left >= 0 &&
        left <= container.clientWidth &&
        top >= 0 &&
        top <= container.clientHeight;

      setPopupPosition((previous) => {
        if (
          previous &&
          previous.left === left &&
          previous.top === top &&
          previous.visible === visible
        ) {
          return previous;
        }
        return { left, top, visible };
      });
    };

    updatePopupPosition();
    viewer.scene.postRender.addEventListener(updatePopupPosition);
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.postRender.removeEventListener(updatePopupPosition);
      }
    };
  }, [selectedFeature]);

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
      <div ref={containerRef} className="absolute inset-0 h-full w-full cursor-crosshair" />

      <div className="absolute left-4 top-4 z-10 grid max-w-[min(30rem,calc(100%-23rem))] gap-2 text-xs text-slate-200">
        <ModeBadge mode={spatialMode} />
        <SelectionSummary bbox={bbox} buffer={buffer} polygon={polygon} />
        <DrawingGuide mode={spatialMode} state={drawingState} />
      </div>

      <ObservationPopup
        feature={selectedFeature}
        onClose={() => setSelectedGbifId(null)}
        position={popupPosition}
      />

      <button
        aria-label="回正地图视角"
        className="map-glass-chip absolute bottom-4 right-4 z-20 inline-flex h-11 items-center gap-2 rounded-md border px-3 text-xs font-semibold text-lime-100 transition hover:border-lime-200/50 hover:bg-lime-200/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-lime-200/60"
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

function DrawingGuide({
  mode,
  state
}: {
  mode: SpatialMode;
  state: DrawingState;
}) {
  const copy = drawingGuideCopy(mode, state);

  return (
    <div className="map-glass-card relative max-w-sm rounded-md px-3 py-2 text-xs text-slate-200">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-lime-200/20 bg-lime-200/10 text-lime-100">
          <MousePointer2 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="map-strong-text font-semibold">{copy.title}</p>
          <p className="map-muted-text mt-1 leading-5">{copy.detail}</p>
        </div>
      </div>
    </div>
  );
}

function drawingGuideCopy(mode: SpatialMode, state: DrawingState) {
  if (mode === "bbox") {
    return state.bboxStarted
      ? {
          title: "矩形框选：选择第二点",
          detail: "移动鼠标预览范围，左键点击第二点完成矩形。"
        }
      : {
          title: "矩形框选",
          detail: "左键点击第一个角点，再移动鼠标并点击第二个角点。"
        };
  }

  if (mode === "polygon") {
    return {
      title: `多边形绘制：${state.polygonPoints} 个点`,
      detail:
        state.polygonPoints >= 3
          ? "继续左键添加顶点，或右键闭合多边形。"
          : "左键依次添加顶点，至少 3 个点后右键闭合。"
    };
  }

  return {
    title: "缓冲区选择",
    detail: "左键点击地图上的中心点，半径使用查询面板中的设置。"
  };
}

function ObservationPopup({
  feature,
  onClose,
  position
}: {
  feature: OccurrenceFeature | null;
  onClose: () => void;
  position: PopupPosition | null;
}) {
  if (!feature || !position?.visible) return null;

  const { properties, geometry } = feature;
  const speciesName = occurrenceLabel(feature);
  const countText =
    properties.individual_count === null
      ? "数量未知"
      : `${properties.individual_count} 只`;

  return (
    <div
      className="pointer-events-auto absolute z-30 w-72 max-w-[calc(100%-2rem)] rounded-md border border-amber-200/70 bg-white p-3 text-sm text-slate-700 shadow-2xl shadow-black/35"
      style={{
        left: position.left,
        top: position.top,
        transform: "translate(-50%, calc(-100% - 18px))"
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-kicker text-amber-700">Selected Point</p>
          <h3 className="mt-1 line-clamp-2 font-semibold leading-5 text-slate-950">
            {speciesName}
          </h3>
          {properties.scientific_name &&
          properties.scientific_name !== speciesName ? (
            <p className="mt-1 truncate text-xs italic text-slate-500">
              {properties.scientific_name}
            </p>
          ) : null}
        </div>
        <button
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          onClick={onClose}
          title="关闭点位气泡"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-3 grid gap-2 text-xs">
        <PopupMeta label="日期">{properties.event_date ?? "日期未知"}</PopupMeta>
        <PopupMeta label="地点">
          {properties.locality ?? "地点未知"}
          <span className="block text-slate-400">
            {properties.state_province ?? "地区未知"} ·{" "}
            {properties.country_code ?? "国家未知"}
          </span>
        </PopupMeta>
        <PopupMeta label="个体数量">{countText}</PopupMeta>
      </dl>

      <p className="mt-3 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
        #{properties.gbif_id} · {geometry.coordinates[0].toFixed(4)},{" "}
        {geometry.coordinates[1].toFixed(4)}
      </p>
      <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-amber-200/70 bg-white" />
    </div>
  );
}

function PopupMeta({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 font-medium leading-5 text-slate-700">
        {children}
      </dd>
    </div>
  );
}

// 天地图 WMTS 令牌（参考作业项目；建议后续迁移到 VITE_TIANDITU_TOKEN 环境变量）。
const TIANDITU_TOKEN = "330550341ec4298fe24d2021ec48a47a";
const TIANDITU_SUBDOMAINS = ["0", "1", "2", "3", "4", "5", "6", "7"];

// 天地图各底图的「底图层 / 注记层」图层代码：
// vec 矢量、img 影像、ter 地形晕渲；cva/cia/cta 为对应注记。
const TIANDITU_LAYERS: Record<BasemapKey, { base: string; label: string }> = {
  street: { base: "vec", label: "cva" },
  imagery: { base: "img", label: "cia" },
  terrain: { base: "ter", label: "cta" }
};

function tiandituProvider(layer: string) {
  return new Cesium.WebMapTileServiceImageryProvider({
    url: `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?tk=${TIANDITU_TOKEN}`,
    layer,
    style: "default",
    format: "tiles",
    tileMatrixSetID: "w",
    subdomains: TIANDITU_SUBDOMAINS,
    maximumLevel: 18,
    tilingScheme: new Cesium.WebMercatorTilingScheme()
  });
}

/** 返回 { 底图 provider, 注记 provider }，注记单独提供以便置于热力图之上。 */
function createBasemapProviders(basemap: BasemapKey) {
  const { base, label } = TIANDITU_LAYERS[basemap];
  return { base: tiandituProvider(base), label: tiandituProvider(label) };
}

function buildWmsCqlFilter(gridSize: GridSize, month: number) {
  return `grid_size=${gridSize} AND year=2024 AND month=${month}`;
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
  enablePointClustering(ds);
  viewer.dataSources.add(ds);
  return ds;
}

// 观测点过密时重叠不美观：开启 Cesium 原生聚合，邻近点合并成带数量的圆泡，放大后自动散开。
function enablePointClustering(ds: Cesium.CustomDataSource) {
  ds.clustering.enabled = true;
  ds.clustering.pixelRange = 28;
  ds.clustering.minimumClusterSize = 3;
  ds.clustering.clusterEvent.addEventListener((clustered, cluster) => {
    cluster.billboard.show = false;
    cluster.label.show = true;
    cluster.label.text = String(clustered.length);
    cluster.label.font = "bold 12px sans-serif";
    cluster.label.fillColor = Cesium.Color.WHITE;
    cluster.label.verticalOrigin = Cesium.VerticalOrigin.CENTER;
    cluster.label.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
    cluster.point.show = true;
    // 圆泡随聚合数量放大（封顶），颜色随密度由黄到红。
    const count = clustered.length;
    cluster.point.pixelSize = Math.min(16 + count * 1.2, 34);
    cluster.point.color = (count >= 50
      ? Cesium.Color.fromCssColorString("#e31a1c")
      : count >= 15
        ? Cesium.Color.fromCssColorString("#fd8d3c")
        : Cesium.Color.fromCssColorString("#fed976")
    ).withAlpha(0.9);
    cluster.point.outlineColor = Cesium.Color.WHITE;
    cluster.point.outlineWidth = 2;
  });
}

function SelectionSummary({ bbox, polygon, buffer }: any) {
  if (bbox) return <SummaryText label="当前矩形" value={bbox.map((n:any) => n?.toFixed?.(2) || "0").join(", ")} tone="teal" />;
  if (polygon) return <SummaryText label="当前多边形" tone="lime" value={`${polygon.coordinates?.[0]?.length || 0} 点`} />;
  if (buffer) return <SummaryText label="当前缓冲区" tone="amber" value={`${buffer.lng?.toFixed?.(4) || "0.00"}, ${buffer.lat?.toFixed?.(4) || "0.00"}`} />;
  return <SummaryText label="当前选择" tone="slate" value="尚未选择范围" />;
}

function ModeBadge({ mode }: { mode: SpatialMode }) {
  const label = mode === "bbox" ? "矩形框选" : mode === "polygon" ? "多边形" : "缓冲区";
  return <span className="map-glass-chip inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-lime-100"><MapPin className="h-3.5 w-3.5" /> {label}</span>;
}

function SummaryText({ label, value, tone }: any) {
  const toneClass = tone === "teal" ? "border-teal-200/50" : tone === "lime" ? "border-lime-200/50" : tone === "amber" ? "border-amber-200/50" : "border-white/25";
  return <div className={`map-glass-chip inline-flex max-w-full items-center rounded-md border px-3 py-2 text-xs ${toneClass}`}><span className="map-muted-text shrink-0 font-medium">{label}</span><span className="map-strong-text ml-2 truncate font-semibold">{value}</span></div>;
}

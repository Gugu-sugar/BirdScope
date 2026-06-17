import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState
} from "react";
import {
  queryOccurrenceBuffer,
  queryOccurrenceByBbox,
  queryOccurrenceWithin
} from "../api/occurrence";
import type { OccurrenceGeoJSON, SpeciesItem } from "../types/api";
import type {
  Bbox,
  BufferSelection,
  GeoJsonPolygon,
  LngLat,
  SpatialMode
} from "../types/geo";

/**
 * 已执行查询的快照：点「执行查询」成功时写入，统一驱动热力图层与三个图表的联动。
 * 物种与空间范围在此快照，月份仍由 store.month 实时提供（便于时间滑块播放）。
 */
export type ActiveQuery = {
  speciesKey?: number;
  speciesName?: string | null;
  bbox: Bbox;
};

type QueryState = {
  selectedSpecies: SpeciesItem | null;
  month: number | null;
  gridSize: GridSize;
  basemap: BasemapKey;
  layerVisibility: LayerVisibility;
  spatialMode: SpatialMode;
  bbox: Bbox | null;
  polygon: GeoJsonPolygon | null;
  buffer: BufferSelection | null;
  radiusKm: number;
  results: OccurrenceGeoJSON | null;
  activeQuery: ActiveQuery | null;
  selectedGbifId: number | null;
  loading: boolean;
  error: string | null;
};

type QueryActions = {
  setSelectedSpecies: (species: SpeciesItem | null) => void;
  setMonth: (month: number | null) => void;
  setGridSize: (gridSize: GridSize) => void;
  setBasemap: (basemap: BasemapKey) => void;
  setLayerVisibility: (layer: keyof LayerVisibility, visible: boolean) => void;
  setSpatialMode: (mode: SpatialMode) => void;
  setBbox: (bbox: Bbox | null) => void;
  setPolygon: (polygon: GeoJsonPolygon | null) => void;
  setBufferCenter: (point: LngLat | null) => void;
  setRadiusKm: (radiusKm: number) => void;
  setResults: (results: OccurrenceGeoJSON | null) => void;
  setSelectedGbifId: (gbifId: number | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  runCurrentQuery: () => Promise<void>;
  clearResults: () => void;
};

type QueryStore = QueryState & QueryActions;

const DEFAULT_RADIUS_KM = 50;

export type GridSize = 0.5 | 1;
export type BasemapKey = "street" | "imagery" | "terrain";

export type LayerVisibility = {
  points: boolean;
  grid: boolean;
  globalWms: boolean;
};

const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  points: true,
  grid: true,
  globalWms: true
};

const QueryContext = createContext<QueryStore | null>(null);

/** 多边形外接矩形 bbox。 */
function polygonBbox(polygon: GeoJsonPolygon): Bbox {
  const ring = polygon.coordinates[0];
  const xs = ring.map((c) => c[0]);
  const ys = ring.map((c) => c[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** 缓冲区中心 ± 半径换算为度的外接矩形（粗略联动用，非精确圆）。 */
function bufferBbox(buffer: BufferSelection): Bbox {
  const dLat = buffer.radiusKm / 111;
  const cos = Math.cos((buffer.lat * Math.PI) / 180);
  const dLng = buffer.radiusKm / (111 * (Math.abs(cos) < 1e-6 ? 1e-6 : cos));
  return [
    buffer.lng - dLng,
    buffer.lat - dLat,
    buffer.lng + dLng,
    buffer.lat + dLat
  ];
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesItem | null>(
    null
  );
  const [month, setMonth] = useState<number | null>(10);
  const [gridSize, setGridSize] = useState<GridSize>(1);
  const [basemap, setBasemap] = useState<BasemapKey>("terrain");
  const [layerVisibility, setLayerVisibilityState] = useState<LayerVisibility>(
    DEFAULT_LAYER_VISIBILITY
  );
  const [spatialMode, setSpatialMode] = useState<SpatialMode>("bbox");
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [polygon, setPolygon] = useState<GeoJsonPolygon | null>(null);
  const [buffer, setBuffer] = useState<BufferSelection | null>(null);
  const [radiusKm, setRadiusKmState] = useState(DEFAULT_RADIUS_KM);
  const [results, setResults] = useState<OccurrenceGeoJSON | null>(null);
  const [activeQuery, setActiveQuery] = useState<ActiveQuery | null>(null);
  const [selectedGbifId, setSelectedGbifId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setRadiusKm = (nextRadiusKm: number) => {
    setRadiusKmState(nextRadiusKm);
    setBuffer((current) =>
      current ? { ...current, radiusKm: nextRadiusKm } : current
    );
  };

  const setBufferCenter = (point: LngLat | null) => {
    setBuffer(point ? { ...point, radiusKm } : null);
  };

  const setLayerVisibility = (
    layer: keyof LayerVisibility,
    visible: boolean
  ) => {
    setLayerVisibilityState((current) => ({
      ...current,
      [layer]: visible
    }));
  };

  const clearResults = () => {
    setResults(null);
    setActiveQuery(null);
    setSelectedGbifId(null);
    setError(null);
  };

  const runCurrentQuery = async () => {
    setLoading(true);
    setError(null);
    setSelectedGbifId(null);

    try {
      const speciesKey = selectedSpecies?.species_key;
      let nextResults: OccurrenceGeoJSON;
      let queriedBbox: Bbox;

      if (spatialMode === "bbox") {
        if (!bbox) {
          throw new Error("请先在地图上选择矩形范围");
        }
        queriedBbox = bbox;
        nextResults = await queryOccurrenceByBbox({
          bbox,
          speciesKey,
          month: month ?? undefined
        });
      } else if (spatialMode === "polygon") {
        if (!polygon) {
          throw new Error("请先在地图上绘制多边形");
        }
        queriedBbox = polygonBbox(polygon);
        nextResults = await queryOccurrenceWithin({
          geometry: polygon,
          species_key: speciesKey,
          month: month ?? undefined,
          year: 2024,
          limit: 2000
        });
      } else {
        if (!buffer) {
          throw new Error("请先在地图上选择缓冲区中心点");
        }
        queriedBbox = bufferBbox(buffer);
        nextResults = await queryOccurrenceBuffer({
          lat: buffer.lat,
          lng: buffer.lng,
          radiusKm: buffer.radiusKm,
          speciesKey,
          month: month ?? undefined
        });
      }

      setResults(nextResults);
      // 快照本次查询的物种与空间范围，统一驱动图层与图表联动（月份仍实时）。
      setActiveQuery({
        speciesKey,
        speciesName:
          selectedSpecies?.display_name ??
          selectedSpecies?.scientific_name ??
          null,
        bbox: queriedBbox
      });
    } catch (error) {
      setResults(null);
      setActiveQuery(null);
      setSelectedGbifId(null);
      setError(error instanceof Error ? error.message : "查询失败");
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo<QueryStore>(
    () => ({
      selectedSpecies,
      month,
      gridSize,
      basemap,
      layerVisibility,
      spatialMode,
      bbox,
      polygon,
      buffer,
      radiusKm,
      results,
      activeQuery,
      selectedGbifId,
      loading,
      error,
      setSelectedSpecies,
      setMonth,
      setGridSize,
      setBasemap,
      setLayerVisibility,
      setSpatialMode,
      setBbox,
      setPolygon,
      setBufferCenter,
      setRadiusKm,
      setResults,
      setSelectedGbifId,
      setLoading,
      setError,
      runCurrentQuery,
      clearResults
    }),
    [
      selectedSpecies,
      month,
      gridSize,
      basemap,
      layerVisibility,
      spatialMode,
      bbox,
      polygon,
      buffer,
      radiusKm,
      results,
      activeQuery,
      selectedGbifId,
      loading,
      error
    ]
  );

  return (
    <QueryContext.Provider value={value}>{children}</QueryContext.Provider>
  );
}

export function useQueryStore() {
  const store = useContext(QueryContext);
  if (!store) {
    throw new Error("useQueryStore must be used within QueryProvider");
  }
  return store;
}

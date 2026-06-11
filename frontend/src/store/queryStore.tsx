import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState
} from "react";
import type { OccurrenceGeoJSON, SpeciesItem } from "../types/api";
import type {
  Bbox,
  BufferSelection,
  GeoJsonPolygon,
  LngLat,
  SpatialMode
} from "../types/geo";

type QueryState = {
  selectedSpecies: SpeciesItem | null;
  month: number | null;
  spatialMode: SpatialMode;
  bbox: Bbox | null;
  polygon: GeoJsonPolygon | null;
  buffer: BufferSelection | null;
  radiusKm: number;
  results: OccurrenceGeoJSON | null;
  loading: boolean;
  error: string | null;
};

type QueryActions = {
  setSelectedSpecies: (species: SpeciesItem | null) => void;
  setMonth: (month: number | null) => void;
  setSpatialMode: (mode: SpatialMode) => void;
  setBbox: (bbox: Bbox | null) => void;
  setPolygon: (polygon: GeoJsonPolygon | null) => void;
  setBufferCenter: (point: LngLat | null) => void;
  setRadiusKm: (radiusKm: number) => void;
  setResults: (results: OccurrenceGeoJSON | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearResults: () => void;
};

type QueryStore = QueryState & QueryActions;

const DEFAULT_RADIUS_KM = 50;

const QueryContext = createContext<QueryStore | null>(null);

export function QueryProvider({ children }: { children: ReactNode }) {
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesItem | null>(
    null
  );
  const [month, setMonth] = useState<number | null>(10);
  const [spatialMode, setSpatialMode] = useState<SpatialMode>("bbox");
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [polygon, setPolygon] = useState<GeoJsonPolygon | null>(null);
  const [buffer, setBuffer] = useState<BufferSelection | null>(null);
  const [radiusKm, setRadiusKmState] = useState(DEFAULT_RADIUS_KM);
  const [results, setResults] = useState<OccurrenceGeoJSON | null>(null);
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

  const clearResults = () => {
    setResults(null);
    setError(null);
  };

  const value = useMemo<QueryStore>(
    () => ({
      selectedSpecies,
      month,
      spatialMode,
      bbox,
      polygon,
      buffer,
      radiusKm,
      results,
      loading,
      error,
      setSelectedSpecies,
      setMonth,
      setSpatialMode,
      setBbox,
      setPolygon,
      setBufferCenter,
      setRadiusKm,
      setResults,
      setLoading,
      setError,
      clearResults
    }),
    [
      selectedSpecies,
      month,
      spatialMode,
      bbox,
      polygon,
      buffer,
      radiusKm,
      results,
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

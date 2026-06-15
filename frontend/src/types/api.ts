import type { GeoJsonPolygon } from "./geo";

export type SpeciesItem = {
  species_key: number;
  taxon_key: number | null;
  bird_order: string | null;
  family: string | null;
  genus: string | null;
  species: string | null;
  scientific_name: string | null;
  record_count: number;
  display_name: string;
};

export type SpeciesSearchResult = {
  results: SpeciesItem[];
  total: number;
};

export type OccurrenceProperties = {
  gbif_id: number;
  species: string | null;
  scientific_name: string | null;
  individual_count: number | null;
  event_date: string | null;
  locality: string | null;
  country_code: string | null;
  state_province: string | null;
};

export type GeoJsonPoint = {
  type: "Point";
  coordinates: [longitude: number, latitude: number];
};

export type OccurrenceFeature = {
  type: "Feature";
  geometry: GeoJsonPoint;
  properties: OccurrenceProperties;
};

export type OccurrenceGeoJSON = {
  type: "FeatureCollection";
  features: OccurrenceFeature[];
  total: number;
};

export type GridFeature = {
  type: "Feature";
  geometry: GeoJsonPolygon;
  properties: {
    record_count: number;
    individual_sum: number | null;
  };
};

export type GridGeoJSON = {
  type: "FeatureCollection";
  features: GridFeature[];
  total: number;
};

export type SpeciesRankItem = {
  species_key: number;
  species: string | null;
  record_count: number;
  individual_sum: number | null;
};

export type MonthlyTrendItem = {
  month: number;
  record_count: number;
  individual_sum: number | null;
};

export type ProvinceStatItem = {
  state_province: string | null;
  record_count: number;
  individual_sum: number | null;
};

export type WithinQueryBody = {
  geometry: GeoJsonPolygon;
  species_key?: number;
  month?: number;
  year?: number;
  limit?: number;
};

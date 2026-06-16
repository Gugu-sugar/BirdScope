import { buildQuery, requestJson } from "./client";
import type {
  GridGeoJSON,
  SpeciesRankItem,
  MonthlyTrendItem,
  ProvinceStatItem
} from "../types/api";
import type { Bbox } from "../types/geo";

export type GridQueryParams = {
  bbox: Bbox;
  gridSize?: number;
  speciesKey?: number;
  month?: number;
  year?: number;
  signal?: AbortSignal;
};

export type SpeciesRankQueryParams = {
  month?: number;
  year?: number;
  limit?: number;
  bbox?: Bbox;
  signal?: AbortSignal;
};

export type MonthlyTrendQueryParams = {
  year?: number;
  speciesKey?: number;
  bbox?: Bbox;
  signal?: AbortSignal;
};

export type ProvinceStatsQueryParams = {
  month?: number;
  year?: number;
  speciesKey?: number;
  bbox?: Bbox;
  signal?: AbortSignal;
};

export function queryGrid({
  bbox,
  gridSize = 1,
  speciesKey,
  month,
  year = 2024,
  signal
}: GridQueryParams) {
  return requestJson<GridGeoJSON>(
    `/stats/grid${buildQuery({
      bbox: bbox.join(","),
      grid_size: gridSize,
      species_key: speciesKey,
      month,
      year
    })}`,
    { signal }
  );
}

export function querySpeciesRank({
  month,
  year = 2024,
  limit = 8,
  bbox,
  signal
}: SpeciesRankQueryParams) {
  return requestJson<SpeciesRankItem[]>(
    `/species/rank${buildQuery({
      month,
      year,
      limit,
      bbox: bbox?.join(",")
    })}`,
    { signal }
  );
}

export function queryMonthlyTrend({
  year = 2024,
  speciesKey,
  bbox,
  signal
}: MonthlyTrendQueryParams) {
  return requestJson<MonthlyTrendItem[]>(
    `/stats/monthly${buildQuery({
      year,
      species_key: speciesKey,
      bbox: bbox?.join(",")
    })}`,
    { signal }
  );
}

export function queryProvinceStats({
  month,
  year = 2024,
  speciesKey,
  bbox,
  signal
}: ProvinceStatsQueryParams) {
  return requestJson<ProvinceStatItem[]>(
    `/stats/province${buildQuery({
      month,
      year,
      species_key: speciesKey,
      bbox: bbox?.join(",")
    })}`,
    { signal }
  );
}

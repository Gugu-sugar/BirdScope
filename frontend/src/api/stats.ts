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
};

export type SpeciesRankQueryParams = {
  month?: number;
  year?: number;
  speciesKey?: number;
  limit?: number;
};

export type MonthlyTrendQueryParams = {
  year?: number;
  speciesKey?: number;
};

export type ProvinceStatsQueryParams = {
  month?: number;
  year?: number;
  speciesKey?: number;
};

export function queryGrid({
  bbox,
  gridSize = 1,
  speciesKey,
  month,
  year = 2024
}: GridQueryParams) {
  return requestJson<GridGeoJSON>(
    `/stats/grid${buildQuery({
      bbox: bbox.join(","),
      grid_size: gridSize,
      species_key: speciesKey,
      month,
      year
    })}`
  );
}

export function querySpeciesRank({
  month,
  year = 2024,
  speciesKey,
  limit = 8
}: SpeciesRankQueryParams) {
  return requestJson<SpeciesRankItem[]>(
    `/species/rank${buildQuery({
      month,
      year,
      species_key: speciesKey,
      limit
    })}`
  );
}

export function queryMonthlyTrend({
  year = 2024,
  speciesKey
}: MonthlyTrendQueryParams) {
  return requestJson<MonthlyTrendItem[]>(
    `/stats/monthly${buildQuery({
      year,
      species_key: speciesKey
    })}`
  );
}

export function queryProvinceStats({
  month,
  year = 2024,
  speciesKey
}: ProvinceStatsQueryParams) {
  return requestJson<ProvinceStatItem[]>(
    `/stats/province${buildQuery({
      month,
      year,
      species_key: speciesKey
    })}`
  );
}

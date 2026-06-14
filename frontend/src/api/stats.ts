import { buildQuery, requestJson } from "./client";
import type { GridGeoJSON } from "../types/api";
import type { Bbox } from "../types/geo";

export type GridQueryParams = {
  bbox: Bbox;
  gridSize?: number;
  speciesKey?: number;
  month?: number;
  year?: number;
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

import { buildQuery, requestJson } from "./client";
import type { OccurrenceGeoJSON, WithinQueryBody } from "../types/api";
import type { Bbox } from "../types/geo";

type CommonOccurrenceParams = {
  speciesKey?: number;
  month?: number;
  year?: number;
  limit?: number;
};

export type BboxQueryParams = CommonOccurrenceParams & {
  bbox: Bbox;
};

export type BufferQueryParams = CommonOccurrenceParams & {
  lat: number;
  lng: number;
  radiusKm: number;
};

export function queryOccurrenceByBbox({
  bbox,
  speciesKey,
  month,
  year = 2024,
  limit = 2000
}: BboxQueryParams) {
  return requestJson<OccurrenceGeoJSON>(
    `/occurrence/points${buildQuery({
      bbox: bbox.join(","),
      species_key: speciesKey,
      month,
      year,
      limit
    })}`
  );
}

export function queryOccurrenceWithin(body: WithinQueryBody) {
  return requestJson<OccurrenceGeoJSON>("/occurrence/within", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function queryOccurrenceBuffer({
  lat,
  lng,
  radiusKm,
  speciesKey,
  month,
  year = 2024,
  limit = 500
}: BufferQueryParams) {
  return requestJson<OccurrenceGeoJSON>(
    `/occurrence/buffer${buildQuery({
      lat,
      lng,
      radius_km: radiusKm,
      species_key: speciesKey,
      month,
      year,
      limit
    })}`
  );
}

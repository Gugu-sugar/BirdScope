import { buildQuery, requestJson } from "./client";
import type { SpeciesItem } from "../types/api";

export function searchSpecies(q: string, limit = 10) {
  return requestJson<SpeciesItem[]>(
    `/species/search${buildQuery({ q, limit })}`
  );
}

import { buildQuery, requestJson } from "./client";
import type { SpeciesSearchResult } from "../types/api";

export function searchSpecies(q: string, limit = 10) {
  return requestJson<SpeciesSearchResult>(
    `/species/search${buildQuery({ q, limit })}`
  );
}

import { requestJson } from "./client";

const GEOSERVER_API_KEY = import.meta.env.VITE_GEOSERVER_API_KEY as
  | string
  | undefined;

export type GeoServerLayer = {
  name: string;
  href?: string;
  title?: string;
  type?: string;
  [key: string]: unknown;
};

export type GeoServerLayersResponse = {
  layers: GeoServerLayer[];
};

export type PublishGeoServerLayerBody = {
  layer_name: string;
  table_name: string;
  style_name?: string;
  cql_filter?: string;
};

export type PublishSpeciesGridBody = {
  layer_name: string;
  species_key: number;
  grid_size: number;
  month?: number | null;
  year?: number;
  style_name?: string;
};

export type PublishGeoServerLayerResult = {
  name?: string;
  layer_name?: string;
  status?: string;
  cql_filter?: string;
  [key: string]: unknown;
};

export async function listGeoServerLayers() {
  const data = await requestJson<GeoServerLayersResponse>("/geoserver/layers");
  return data.layers ?? [];
}

export function publishGeoServerLayer(
  body: PublishGeoServerLayerBody,
  apiKey = GEOSERVER_API_KEY
) {
  return requestJson<PublishGeoServerLayerResult>("/geoserver/layers", {
    method: "POST",
    headers: apiKey ? { "X-API-Key": apiKey } : undefined,
    body: JSON.stringify(body)
  });
}

export function publishSpeciesGridLayer(
  body: PublishSpeciesGridBody,
  apiKey = GEOSERVER_API_KEY
) {
  return requestJson<PublishGeoServerLayerResult>("/geoserver/species-grid", {
    method: "POST",
    headers: apiKey ? { "X-API-Key": apiKey } : undefined,
    body: JSON.stringify(body)
  });
}

export function deleteGeoServerLayer(
  layerName: string,
  apiKey = GEOSERVER_API_KEY
) {
  return requestJson<{ status?: string; layer?: string }>(
    `/geoserver/layers/${encodeURIComponent(layerName)}`,
    {
      method: "DELETE",
      headers: apiKey ? { "X-API-Key": apiKey } : undefined
    }
  );
}

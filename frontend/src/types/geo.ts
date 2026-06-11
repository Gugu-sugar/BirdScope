export type Bbox = [minx: number, miny: number, maxx: number, maxy: number];

export type LngLat = {
  lng: number;
  lat: number;
};

export type GeoJsonPosition = [longitude: number, latitude: number];

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: GeoJsonPosition[][];
};

export type SpatialMode = "bbox" | "polygon" | "buffer";

export type BufferSelection = LngLat & {
  radiusKm: number;
};

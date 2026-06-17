from datetime import date
from typing import Any
from pydantic import BaseModel, field_validator


class OccurrenceProperties(BaseModel):
    gbif_id: int
    species: str | None
    scientific_name: str | None
    individual_count: int | None
    event_date: date | None
    locality: str | None
    country_code: str | None
    state_province: str | None

    @field_validator("species", mode="before")
    @classmethod
    def fallback_species(cls, v: Any, info: Any) -> Any:
        return v  # fallback 在 service 层处理


class OccurrenceFeature(BaseModel):
    type: str = "Feature"
    geometry: dict[str, Any]
    properties: OccurrenceProperties


class OccurrenceGeoJSON(BaseModel):
    type: str = "FeatureCollection"
    features: list[OccurrenceFeature]
    total: int


class BboxQuery(BaseModel):
    """?bbox=minx,miny,maxx,maxy"""
    bbox: str
    species_key: int | None = None
    month: int | None = None
    year: int | None = 2024
    limit: int = 2000

    def parse_bbox(self) -> tuple[float, float, float, float]:
        parts = [float(x) for x in self.bbox.split(",")]
        if len(parts) != 4:
            raise ValueError("bbox must be 'minx,miny,maxx,maxy'")
        return tuple(parts)  # type: ignore


class WithinQuery(BaseModel):
    geometry: dict[str, Any]   # GeoJSON geometry
    species_key: int | None = None
    month: int | None = None
    months: list[int] | None = None  # 多选月份，非空时优先于 month；空/缺省表示全年
    year: int | None = 2024
    limit: int = 2000


class BufferQuery(BaseModel):
    lat: float
    lng: float
    radius_km: float = 10.0
    species_key: int | None = None
    month: int | None = None
    year: int | None = 2024
    limit: int = 500

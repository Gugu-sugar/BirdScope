from pydantic import BaseModel
from typing import Any


class MonthlyTrendItem(BaseModel):
    month: int
    record_count: int
    individual_sum: int | None


class ProvinceStatItem(BaseModel):
    state_province: str
    record_count: int


class GridCell(BaseModel):
    type: str = "Feature"
    geometry: dict[str, Any]
    properties: dict[str, Any]


class GridGeoJSON(BaseModel):
    type: str = "FeatureCollection"
    features: list[GridCell]
    total: int


class MigrationPoint(BaseModel):
    month: int
    center_lon: float
    center_lat: float
    record_count: int

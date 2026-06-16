from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.schemas.stats import MonthlyTrendItem, ProvinceStatItem, GridGeoJSON, MigrationPoint
from app.services import spatial

router = APIRouter(prefix="/stats", tags=["stats"])


def parse_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    """解析 'minx,miny,maxx,maxy'；为空返回 None，格式错误抛 400。"""
    if not bbox:
        return None
    try:
        minx, miny, maxx, maxy = (float(x) for x in bbox.split(","))
    except Exception:
        raise HTTPException(400, "bbox 格式错误，应为 minx,miny,maxx,maxy")
    return minx, miny, maxx, maxy


@router.get("/monthly", response_model=list[MonthlyTrendItem])
def monthly_trend(
    species_key: int | None = Query(None),
    country_code: str | None = Query(None, min_length=2, max_length=2),
    year: int = Query(2024),
    bbox: str | None = Query(None, description="minx,miny,maxx,maxy，带则按范围实时联动"),
    db: Session = Depends(get_db),
):
    return spatial.query_monthly_trend(
        db, species_key, country_code, year, bbox=parse_bbox(bbox)
    )


@router.get("/province", response_model=list[ProvinceStatItem])
def province_stats(
    country_code: str | None = Query(None, min_length=2, max_length=2),
    month: int | None = Query(None, ge=1, le=12),
    year: int = Query(2024),
    species_key: int | None = Query(None),
    bbox: str | None = Query(None, description="minx,miny,maxx,maxy，带则按范围实时联动"),
    db: Session = Depends(get_db),
):
    return spatial.query_province_stats(
        db, country_code, month, year, species_key, bbox=parse_bbox(bbox)
    )


@router.get("/grid", response_model=GridGeoJSON)
def grid_aggregation(
    bbox: str = Query(..., description="minx,miny,maxx,maxy"),
    grid_size: float = Query(1.0, gt=0, le=10),
    species_key: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(2024),
    max_cells: int = Query(10000, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    minx, miny, maxx, maxy = parse_bbox(bbox)
    features = spatial.query_grid(
        db, minx, miny, maxx, maxy, grid_size, species_key, month, year, max_cells
    )
    return {"type": "FeatureCollection", "features": features, "total": len(features)}


@router.get("/migration", response_model=list[MigrationPoint])
def migration_centroid(
    species_key: int = Query(...),
    year: int = Query(2024),
    db: Session = Depends(get_db),
):
    return spatial.query_migration(db, species_key, year)

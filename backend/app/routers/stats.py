from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.schemas.stats import MonthlyTrendItem, ProvinceStatItem, GridGeoJSON, MigrationPoint
from app.services import spatial

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/monthly", response_model=list[MonthlyTrendItem])
def monthly_trend(
    species_key: int | None = Query(None),
    country_code: str | None = Query(None, min_length=2, max_length=2),
    year: int = Query(2024),
    db: Session = Depends(get_db),
):
    return spatial.query_monthly_trend(db, species_key, country_code, year)


@router.get("/province", response_model=list[ProvinceStatItem])
def province_stats(
    country_code: str | None = Query(None, min_length=2, max_length=2),
    month: int | None = Query(None, ge=1, le=12),
    year: int = Query(2024),
    species_key: int | None = Query(None),
    db: Session = Depends(get_db),
):
    return spatial.query_province_stats(db, country_code, month, year, species_key)


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
    try:
        minx, miny, maxx, maxy = [float(x) for x in bbox.split(",")]
    except Exception:
        raise HTTPException(400, "bbox 格式错误")
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

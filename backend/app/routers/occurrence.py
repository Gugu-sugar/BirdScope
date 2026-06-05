from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.deps import get_db
from app.schemas.occurrence import OccurrenceGeoJSON, WithinQuery, BufferQuery
from app.services import spatial

router = APIRouter(prefix="/occurrence", tags=["occurrence"])


@router.get("/points", response_model=OccurrenceGeoJSON)
def points_in_bbox(
    bbox: str = Query(..., description="minx,miny,maxx,maxy"),
    species_key: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(2024),
    limit: int = Query(2000, le=5000),
    db: Session = Depends(get_db),
):
    try:
        minx, miny, maxx, maxy = [float(x) for x in bbox.split(",")]
    except Exception:
        raise HTTPException(400, "bbox 格式错误，应为 minx,miny,maxx,maxy")
    features = spatial.query_bbox(db, minx, miny, maxx, maxy, species_key, month, year, limit)
    return {"type": "FeatureCollection", "features": features, "total": len(features)}


@router.post("/within", response_model=OccurrenceGeoJSON)
def points_within_polygon(body: WithinQuery, db: Session = Depends(get_db)):
    features = spatial.query_within(
        db, body.geometry, body.species_key, body.month, body.year, body.limit
    )
    return {"type": "FeatureCollection", "features": features, "total": len(features)}


@router.get("/buffer", response_model=OccurrenceGeoJSON)
def points_in_buffer(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10.0, gt=0, le=500),
    species_key: int | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(2024),
    limit: int = Query(500, le=2000),
    db: Session = Depends(get_db),
):
    features = spatial.query_buffer(db, lat, lng, radius_km, species_key, month, year, limit)
    return {"type": "FeatureCollection", "features": features, "total": len(features)}

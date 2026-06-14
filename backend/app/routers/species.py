from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.deps import get_db
from app.schemas.species import SpeciesItem, SpeciesRankItem
from app.services import spatial

router = APIRouter(prefix="/species", tags=["species"])


def _to_item(row) -> SpeciesItem:
    return SpeciesItem(
        species_key=row.species_key,
        taxon_key=row.taxon_key,
        bird_order=row.bird_order,
        family=row.family,
        genus=row.genus,
        species=row.species,
        scientific_name=row.scientific_name,
        record_count=row.record_count or 0,
        display_name=row.species or row.scientific_name or str(row.species_key),
    )


@router.get("/search", response_model=list[SpeciesItem])
def search_species(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
):
    sql = text("""
        SELECT species_key, taxon_key, bird_order, family, genus,
               species, scientific_name, record_count
        FROM species_lookup
        WHERE to_tsvector('simple', coalesce(species,'') || ' ' || coalesce(scientific_name,''))
              @@ plainto_tsquery('simple', :q)
           OR species ILIKE :like
           OR scientific_name ILIKE :like
        ORDER BY record_count DESC NULLS LAST
        LIMIT :limit
    """)
    rows = db.execute(sql, {"q": q, "like": f"%{q}%", "limit": limit}).fetchall()
    items = [_to_item(r) for r in rows]
    return items


@router.get("/rank", response_model=list[SpeciesRankItem])
def species_rank(
    country_code: str | None = Query(None, min_length=2, max_length=2),
    month: int | None = Query(None, ge=1, le=12),
    year: int = Query(2024),
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
):
    return spatial.query_species_rank(db, country_code, month, year, limit)


@router.get("/{species_key}", response_model=SpeciesItem)
def get_species(species_key: int, db: Session = Depends(get_db)):
    sql = text("""
        SELECT species_key, taxon_key, bird_order, family, genus,
               species, scientific_name, record_count
        FROM species_lookup WHERE species_key = :key
    """)
    row = db.execute(sql, {"key": species_key}).fetchone()
    if not row:
        raise HTTPException(404, f"species_key {species_key} not found")
    return _to_item(row)

from pydantic import BaseModel


class SpeciesItem(BaseModel):
    species_key: int
    taxon_key: int | None
    bird_order: str | None
    family: str | None
    genus: str | None
    species: str | None
    scientific_name: str | None
    record_count: int
    display_name: str  # species 优先，fallback scientific_name


class SpeciesRankItem(BaseModel):
    species_key: int
    species: str
    record_count: int
    individual_sum: int | None

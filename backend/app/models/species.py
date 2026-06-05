from sqlalchemy import BigInteger, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class SpeciesLookup(Base):
    __tablename__ = "species_lookup"

    species_key: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    taxon_key: Mapped[int | None] = mapped_column(BigInteger)
    bird_order: Mapped[str | None] = mapped_column(Text)
    family: Mapped[str | None] = mapped_column(Text)
    genus: Mapped[str | None] = mapped_column(Text)
    species: Mapped[str | None] = mapped_column(Text)
    scientific_name: Mapped[str | None] = mapped_column(Text)
    record_count: Mapped[int] = mapped_column(Integer, default=0)

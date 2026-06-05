from sqlalchemy import BigInteger, SmallInteger, Integer, Text, Date, Float
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry
from app.db import Base


class OccurrenceClean(Base):
    __tablename__ = "occurrence_clean"

    gbif_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    species_key: Mapped[int | None] = mapped_column(BigInteger)
    taxon_key: Mapped[int | None] = mapped_column(BigInteger)
    bird_order: Mapped[str | None] = mapped_column(Text)
    family: Mapped[str | None] = mapped_column(Text)
    genus: Mapped[str | None] = mapped_column(Text)
    species: Mapped[str | None] = mapped_column(Text)
    scientific_name: Mapped[str | None] = mapped_column(Text)
    country_code: Mapped[str | None] = mapped_column(Text)
    state_province: Mapped[str | None] = mapped_column(Text)
    locality: Mapped[str | None] = mapped_column(Text)
    individual_count: Mapped[int | None] = mapped_column(Integer)
    event_date: Mapped[object | None] = mapped_column(Date)
    year: Mapped[int | None] = mapped_column(SmallInteger)
    month: Mapped[int | None] = mapped_column(SmallInteger)
    day: Mapped[int | None] = mapped_column(SmallInteger)
    license: Mapped[str | None] = mapped_column(Text)
    issue: Mapped[str | None] = mapped_column(Text)
    geom: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))

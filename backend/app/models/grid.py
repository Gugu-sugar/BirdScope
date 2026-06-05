from sqlalchemy import SmallInteger, Integer, Float, Double
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geometry
from app.db import Base


class OccurrenceGridMonthly(Base):
    __tablename__ = "occurrence_grid_monthly"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    grid_size: Mapped[float] = mapped_column(Float, nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, nullable=False)
    individual_sum: Mapped[int | None] = mapped_column(Integer)
    center_lon: Mapped[float | None] = mapped_column(Double)
    center_lat: Mapped[float | None] = mapped_column(Double)
    geom: Mapped[object | None] = mapped_column(Geometry("POLYGON", srid=4326))

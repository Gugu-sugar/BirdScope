from sqlalchemy import SmallInteger, Integer, BigInteger, Text, String, Double
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class OccurrenceStatsMonthly(Base):
    """图表月度事实表，覆盖 monthly / province / migration / rank 四接口的上卷查询。"""

    __tablename__ = "occurrence_stats_monthly"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    country_code: Mapped[str | None] = mapped_column(String(2))
    state_province: Mapped[str | None] = mapped_column(Text)
    species_key: Mapped[int | None] = mapped_column(BigInteger)
    record_count: Mapped[int] = mapped_column(Integer, nullable=False)
    individual_sum: Mapped[int | None] = mapped_column(BigInteger)
    sum_lon: Mapped[float | None] = mapped_column(Double)
    sum_lat: Mapped[float | None] = mapped_column(Double)

"""PostGIS 空间查询封装，所有 SQL 在此层，router 不直接写 SQL。"""
import json
from typing import Any
from sqlalchemy import text
from sqlalchemy.orm import Session


def _build_filters(
    species_key: int | None,
    month: int | None,
    year: int | None,
) -> tuple[str, dict]:
    """返回 WHERE 子句片段（不含 WHERE 关键字）和参数字典。"""
    clauses, params = [], {}
    if species_key is not None:
        clauses.append("species_key = :species_key")
        params["species_key"] = species_key
    if month is not None:
        clauses.append("month = :month")
        params["month"] = month
    if year is not None:
        clauses.append("year = :year")
        params["year"] = year
    where = " AND ".join(clauses) if clauses else "1=1"
    return where, params


# 图表实时空间聚合的 bbox 面积上限（平方度）。超过则回退预聚合事实表，
# 避免大洲/全球范围实时扫描 occurrence_clean 拖慢响应。
MAX_REALTIME_BBOX_AREA_DEG2 = 3000.0
# 实时聚合语句超时（毫秒），兜底防止个别慢查询拖垮连接。
_REALTIME_STATEMENT_TIMEOUT_MS = 8000

Bbox = tuple[float, float, float, float]


def _bbox_realtime_ok(bbox: Bbox | None) -> bool:
    """bbox 存在且面积在护栏内时，才走 occurrence_clean 实时聚合，否则回退事实表。"""
    if not bbox:
        return False
    minx, miny, maxx, maxy = bbox
    return abs((maxx - minx) * (maxy - miny)) <= MAX_REALTIME_BBOX_AREA_DEG2


def _bbox_params(bbox: Bbox) -> dict:
    minx, miny, maxx, maxy = bbox
    return {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy}


# 走 GIST 索引的 bbox 过滤片段（聚合统计用外接框即可，无需精确 ST_Within）。
_BBOX_FILTER = "geom && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)"


def _apply_statement_timeout(db: Session) -> None:
    # SET LOCAL 仅在当前事务内生效，随提交/回滚自动失效。
    db.execute(text(f"SET LOCAL statement_timeout = {_REALTIME_STATEMENT_TIMEOUT_MS}"))


def _row_to_feature(row: Any) -> dict:
    species = row.species or row.scientific_name
    return {
        "type": "Feature",
        "geometry": json.loads(row.geom_json),
        "properties": {
            "gbif_id": row.gbif_id,
            "species": species,
            "scientific_name": row.scientific_name,
            "individual_count": row.individual_count,
            "event_date": str(row.event_date) if row.event_date else None,
            "locality": row.locality,
            "country_code": row.country_code,
            "state_province": row.state_province,
        },
    }


def query_bbox(
    db: Session,
    minx: float, miny: float, maxx: float, maxy: float,
    species_key: int | None = None,
    month: int | None = None,
    year: int | None = None,
    limit: int = 2000,
) -> list[dict]:
    where, params = _build_filters(species_key, month, year)
    params.update({"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy, "limit": limit})
    sql = text(f"""
        SELECT gbif_id, species, scientific_name, individual_count,
               event_date, locality, country_code, state_province,
               ST_AsGeoJSON(geom) AS geom_json
        FROM occurrence_clean
        WHERE ST_Within(geom, ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326))
          AND {where}
        LIMIT :limit
    """)
    rows = db.execute(sql, params).fetchall()
    return [_row_to_feature(r) for r in rows]


def query_within(
    db: Session,
    geojson_geometry: dict,
    species_key: int | None = None,
    month: int | None = None,
    year: int | None = None,
    limit: int = 2000,
) -> list[dict]:
    where, params = _build_filters(species_key, month, year)
    params.update({"geom_wkt": json.dumps(geojson_geometry), "limit": limit})
    sql = text(f"""
        SELECT gbif_id, species, scientific_name, individual_count,
               event_date, locality, country_code, state_province,
               ST_AsGeoJSON(geom) AS geom_json
        FROM occurrence_clean
        WHERE ST_Within(geom, ST_GeomFromGeoJSON(:geom_wkt))
          AND {where}
        LIMIT :limit
    """)
    rows = db.execute(sql, params).fetchall()
    return [_row_to_feature(r) for r in rows]


def query_buffer(
    db: Session,
    lat: float, lng: float, radius_km: float,
    species_key: int | None = None,
    month: int | None = None,
    year: int | None = None,
    limit: int = 500,
) -> list[dict]:
    where, params = _build_filters(species_key, month, year)
    params.update({"lng": lng, "lat": lat, "radius_m": radius_km * 1000, "limit": limit})
    sql = text(f"""
        SELECT gbif_id, species, scientific_name, individual_count,
               event_date, locality, country_code, state_province,
               ST_AsGeoJSON(geom) AS geom_json
        FROM occurrence_clean
        WHERE ST_DWithin(
            geom::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :radius_m
        ) AND {where}
        LIMIT :limit
    """)
    rows = db.execute(sql, params).fetchall()
    return [_row_to_feature(r) for r in rows]


# 已由 build_grid.py 预聚合的网格粒度（度）。命中这些粒度且无物种过滤时，
# 直接查 occurrence_grid_monthly（O(网格数)，~6ms），否则回退实时聚合。
PREBUILT_GRID_SIZES = {1.0, 0.5}


def query_grid(
    db: Session,
    minx: float, miny: float, maxx: float, maxy: float,
    grid_size: float = 1.0,
    species_key: int | None = None,
    month: int | None = None,
    year: int | None = None,
    max_cells: int = 10000,
) -> list[dict]:
    """网格热力聚合。

    路由策略：
    - 无 species_key 且 grid_size 已预聚合 → 查预聚合表（快，与明细总量脱钩）
    - 否则（带物种过滤 / 非预聚合粒度）→ 实时聚合 occurrence_clean
      （此场景前端通常已缩放到局部 bbox，扫描行数有限）
    """
    if species_key is None and grid_size in PREBUILT_GRID_SIZES:
        return _query_grid_prebuilt(db, minx, miny, maxx, maxy, grid_size, month, year, max_cells)
    return _query_grid_realtime(
        db, minx, miny, maxx, maxy, grid_size, species_key, month, year, max_cells
    )


def _query_grid_prebuilt(
    db: Session,
    minx: float, miny: float, maxx: float, maxy: float,
    grid_size: float,
    month: int | None,
    year: int | None,
    max_cells: int,
) -> list[dict]:
    # 预聚合表每行是 (year, month, 格子)。month 为空时同一格有多月行，
    # 须按格子 GROUP BY 跨月求和，才与实时聚合（按格累加全月）口径一致。
    params = {
        "minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy,
        "gs": grid_size, "month": month, "year": year, "max_cells": max_cells,
    }
    sql = text("""
        SELECT
            SUM(record_count)::int   AS record_count,
            SUM(individual_sum)::int AS individual_sum,
            center_lon, center_lat,
            ST_AsGeoJSON(geom)       AS geom_json
        FROM occurrence_grid_monthly
        WHERE grid_size = :gs
          AND geom && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
          AND (:year  IS NULL OR year  = :year)
          AND (:month IS NULL OR month = :month)
        GROUP BY geom, center_lon, center_lat
        LIMIT :max_cells
    """)
    rows = db.execute(sql, params).fetchall()
    return [
        {
            "type": "Feature",
            "geometry": json.loads(r.geom_json),
            "properties": {
                "record_count": r.record_count,
                "individual_sum": r.individual_sum,
                "center_lon": r.center_lon,
                "center_lat": r.center_lat,
            },
        }
        for r in rows
    ]


def _query_grid_realtime(
    db: Session,
    minx: float, miny: float, maxx: float, maxy: float,
    grid_size: float,
    species_key: int | None,
    month: int | None,
    year: int | None,
    max_cells: int,
) -> list[dict]:
    where, params = _build_filters(species_key, month, year)
    params.update({
        "minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy,
        "gs": grid_size, "max_cells": max_cells,
    })
    sql = text(f"""
        SELECT
            COUNT(*)::int AS record_count,
            SUM(individual_count)::int AS individual_sum,
            FLOOR(ST_X(geom) / :gs) * :gs AS gx,
            FLOOR(ST_Y(geom) / :gs) * :gs AS gy,
            FLOOR(ST_X(geom) / :gs) * :gs + :gs / 2 AS center_lon,
            FLOOR(ST_Y(geom) / :gs) * :gs + :gs / 2 AS center_lat,
            ST_AsGeoJSON(ST_MakeEnvelope(
                FLOOR(ST_X(geom) / :gs) * :gs,
                FLOOR(ST_Y(geom) / :gs) * :gs,
                FLOOR(ST_X(geom) / :gs) * :gs + :gs,
                FLOOR(ST_Y(geom) / :gs) * :gs + :gs,
                4326
            )) AS geom_json
        FROM occurrence_clean
        WHERE ST_Within(geom, ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326))
          AND {where}
        GROUP BY gx, gy
        LIMIT :max_cells
    """)
    rows = db.execute(sql, params).fetchall()
    return [
        {
            "type": "Feature",
            "geometry": json.loads(r.geom_json),
            "properties": {
                "record_count": r.record_count,
                "individual_sum": r.individual_sum,
                "center_lon": r.center_lon,
                "center_lat": r.center_lat,
            },
        }
        for r in rows
    ]


def _monthly_trend_realtime(
    db: Session, species_key: int | None, year: int, bbox: Bbox
) -> list[dict]:
    _apply_statement_timeout(db)
    clauses = ["year = :year", _BBOX_FILTER]
    params: dict = {"year": year, **_bbox_params(bbox)}
    if species_key is not None:
        clauses.append("species_key = :species_key")
        params["species_key"] = species_key
    where = " AND ".join(clauses)
    sql = text(f"""
        SELECT month,
               COUNT(*)::int              AS record_count,
               SUM(individual_count)::int AS individual_sum
        FROM occurrence_clean
        WHERE {where}
        GROUP BY month ORDER BY month
    """)
    rows = db.execute(sql, params).fetchall()
    return [
        {"month": r.month, "record_count": r.record_count, "individual_sum": r.individual_sum}
        for r in rows
    ]


def query_monthly_trend(
    db: Session,
    species_key: int | None = None,
    country_code: str | None = None,
    year: int = 2024,
    bbox: Bbox | None = None,
) -> list[dict]:
    # 带 bbox（且面积在护栏内）→ 实时聚合明细表，按画的框联动；否则走预聚合事实表。
    if _bbox_realtime_ok(bbox):
        return _monthly_trend_realtime(db, species_key, year, bbox)  # type: ignore[arg-type]
    # 走预聚合事实表 occurrence_stats_monthly，按 month SUM 上卷（见 build_stats.py）
    clauses = ["year = :year"]
    params: dict = {"year": year}
    if species_key:
        clauses.append("species_key = :species_key")
        params["species_key"] = species_key
    if country_code:
        clauses.append("country_code = :country_code")
        params["country_code"] = country_code
    where = " AND ".join(clauses)
    sql = text(f"""
        SELECT month,
               SUM(record_count)::int   AS record_count,
               SUM(individual_sum)::int AS individual_sum
        FROM occurrence_stats_monthly
        WHERE {where}
        GROUP BY month ORDER BY month
    """)
    rows = db.execute(sql, params).fetchall()
    return [
        {"month": r.month, "record_count": r.record_count, "individual_sum": r.individual_sum}
        for r in rows
    ]


def _province_stats_realtime(
    db: Session, month: int | None, year: int, species_key: int | None, bbox: Bbox
) -> list[dict]:
    _apply_statement_timeout(db)
    clauses = ["year = :year", "state_province IS NOT NULL", _BBOX_FILTER]
    params: dict = {"year": year, **_bbox_params(bbox)}
    if month:
        clauses.append("month = :month")
        params["month"] = month
    if species_key is not None:
        clauses.append("species_key = :species_key")
        params["species_key"] = species_key
    where = " AND ".join(clauses)
    sql = text(f"""
        SELECT state_province, COUNT(*)::int AS record_count
        FROM occurrence_clean
        WHERE {where}
        GROUP BY state_province ORDER BY record_count DESC
        LIMIT 50
    """)
    rows = db.execute(sql, params).fetchall()
    return [{"state_province": r.state_province, "record_count": r.record_count} for r in rows]


def query_province_stats(
    db: Session,
    country_code: str | None = None,
    month: int | None = None,
    year: int = 2024,
    species_key: int | None = None,
    bbox: Bbox | None = None,
) -> list[dict]:
    if _bbox_realtime_ok(bbox):
        return _province_stats_realtime(db, month, year, species_key, bbox)  # type: ignore[arg-type]
    # 走预聚合事实表，按 state_province SUM 上卷
    clauses = ["year = :year", "state_province IS NOT NULL"]
    params: dict = {"year": year}
    if country_code:
        clauses.append("country_code = :country_code")
        params["country_code"] = country_code
    if month:
        clauses.append("month = :month")
        params["month"] = month
    if species_key is not None:
        clauses.append("species_key = :species_key")
        params["species_key"] = species_key
    where = " AND ".join(clauses)
    sql = text(f"""
        SELECT state_province, SUM(record_count)::int AS record_count
        FROM occurrence_stats_monthly
        WHERE {where}
        GROUP BY state_province ORDER BY record_count DESC
        LIMIT 50
    """)
    rows = db.execute(sql, params).fetchall()
    return [{"state_province": r.state_province, "record_count": r.record_count} for r in rows]


def query_migration(
    db: Session,
    species_key: int,
    year: int = 2024,
) -> list[dict]:
    # 重心 = 加权平均：SUM(sum_lon)/SUM(record_count)，与明细 AVG(ST_X) 口径一致
    sql = text("""
        SELECT month,
               (SUM(sum_lon) / NULLIF(SUM(record_count), 0))::float AS center_lon,
               (SUM(sum_lat) / NULLIF(SUM(record_count), 0))::float AS center_lat,
               SUM(record_count)::int AS record_count
        FROM occurrence_stats_monthly
        WHERE species_key = :species_key AND year = :year
        GROUP BY month ORDER BY month
    """)
    rows = db.execute(sql, {"species_key": species_key, "year": year}).fetchall()
    return [
        {"month": r.month, "center_lon": r.center_lon, "center_lat": r.center_lat, "record_count": r.record_count}
        for r in rows
    ]


def _species_rank_realtime(
    db: Session, month: int | None, year: int, limit: int, bbox: Bbox
) -> list[dict]:
    _apply_statement_timeout(db)
    clauses = ["year = :year", "species_key IS NOT NULL", _BBOX_FILTER]
    params: dict = {"year": year, "limit": limit, **_bbox_params(bbox)}
    if month:
        clauses.append("month = :month")
        params["month"] = month
    where = " AND ".join(clauses)
    sql = text(f"""
        WITH agg AS (
            SELECT species_key,
                   COUNT(*)::int              AS record_count,
                   SUM(individual_count)::int AS individual_sum
            FROM occurrence_clean
            WHERE {where}
            GROUP BY species_key
            ORDER BY record_count DESC
            LIMIT :limit
        )
        SELECT a.species_key,
               COALESCE(s.species, s.scientific_name, a.species_key::text) AS species,
               a.record_count,
               a.individual_sum
        FROM agg a
        LEFT JOIN species_lookup s ON s.species_key = a.species_key
        ORDER BY a.record_count DESC
    """)
    rows = db.execute(sql, params).fetchall()
    return [
        {
            "species_key": r.species_key,
            "species": r.species,
            "record_count": r.record_count,
            "individual_sum": r.individual_sum,
        }
        for r in rows
    ]


def query_species_rank(
    db: Session,
    country_code: str | None = None,
    month: int | None = None,
    year: int = 2024,
    limit: int = 20,
    bbox: Bbox | None = None,
) -> list[dict]:
    if _bbox_realtime_ok(bbox):
        return _species_rank_realtime(db, month, year, limit, bbox)  # type: ignore[arg-type]
    # 先在事实表上按整数 species_key 聚合并取 top-N，再 JOIN species_lookup 取展示名。
    # 关键：JOIN 与按文本排序只作用于已截断的 N 行，避免对全部 ~1 万物种 JOIN 后再排序。
    clauses = ["year = :year", "species_key IS NOT NULL"]
    params: dict = {"year": year, "limit": limit}
    if country_code:
        clauses.append("country_code = :country_code")
        params["country_code"] = country_code
    if month:
        clauses.append("month = :month")
        params["month"] = month
    where = " AND ".join(clauses)
    sql = text(f"""
        WITH agg AS (
            SELECT species_key,
                   SUM(record_count)::int   AS record_count,
                   SUM(individual_sum)::int AS individual_sum
            FROM occurrence_stats_monthly
            WHERE {where}
            GROUP BY species_key
            ORDER BY record_count DESC
            LIMIT :limit
        )
        SELECT a.species_key,
               COALESCE(s.species, s.scientific_name, a.species_key::text) AS species,
               a.record_count,
               a.individual_sum
        FROM agg a
        LEFT JOIN species_lookup s ON s.species_key = a.species_key
        ORDER BY a.record_count DESC
    """)
    rows = db.execute(sql, params).fetchall()
    return [
        {
            "species_key": r.species_key,
            "species": r.species,
            "record_count": r.record_count,
            "individual_sum": r.individual_sum,
        }
        for r in rows
    ]

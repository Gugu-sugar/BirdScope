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


def query_monthly_trend(
    db: Session,
    species_key: int | None = None,
    country_code: str | None = None,
    year: int = 2024,
) -> list[dict]:
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
               COUNT(*)::int AS record_count,
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


def query_province_stats(
    db: Session,
    country_code: str | None = None,
    month: int | None = None,
    year: int = 2024,
) -> list[dict]:
    clauses = ["year = :year", "state_province IS NOT NULL"]
    params: dict = {"year": year}
    if country_code:
        clauses.append("country_code = :country_code")
        params["country_code"] = country_code
    if month:
        clauses.append("month = :month")
        params["month"] = month
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


def query_migration(
    db: Session,
    species_key: int,
    year: int = 2024,
) -> list[dict]:
    sql = text("""
        SELECT month,
               AVG(ST_X(geom))::float AS center_lon,
               AVG(ST_Y(geom))::float AS center_lat,
               COUNT(*)::int AS record_count
        FROM occurrence_clean
        WHERE species_key = :species_key AND year = :year
        GROUP BY month ORDER BY month
    """)
    rows = db.execute(sql, {"species_key": species_key, "year": year}).fetchall()
    return [
        {"month": r.month, "center_lon": r.center_lon, "center_lat": r.center_lat, "record_count": r.record_count}
        for r in rows
    ]


def query_species_rank(
    db: Session,
    country_code: str | None = None,
    month: int | None = None,
    year: int = 2024,
    limit: int = 20,
) -> list[dict]:
    clauses = ["o.year = :year", "o.species_key IS NOT NULL"]
    params: dict = {"year": year, "limit": limit}
    if country_code:
        clauses.append("o.country_code = :country_code")
        params["country_code"] = country_code
    if month:
        clauses.append("o.month = :month")
        params["month"] = month
    where = " AND ".join(clauses)
    sql = text(f"""
        SELECT o.species_key,
               COALESCE(s.species, s.scientific_name, o.scientific_name, o.species_key::text) AS species,
               COUNT(*)::int AS record_count,
               SUM(o.individual_count)::int AS individual_sum
        FROM occurrence_clean o
        LEFT JOIN species_lookup s ON s.species_key = o.species_key
        WHERE {where}
        GROUP BY o.species_key, COALESCE(s.species, s.scientific_name, o.scientific_name, o.species_key::text)
        ORDER BY record_count DESC
        LIMIT :limit
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

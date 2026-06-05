# BirdScope Backend — Agent Reference

This document is the authoritative specification for any AI agent working on the BirdScope backend. Read this file before touching any code.

---

## Project Identity

**BirdScope** is a 3D bird observation map platform built on eBird/GBIF data.

- **Backend stack**: Python 3.11+, FastAPI, SQLAlchemy 2.x, PostGIS, GeoServer 2.28.1
- **Database**: PostgreSQL 16 + PostGIS 3.4, database name `birdscope` (already created and populated with dev sample)
- **Data source**: GBIF Simple CSV download (~15 GB TSV, UTF-8, tab-separated), ~27.6M rows of bird observations, stored at `D:/EBIRD/0009321-260519110011954.csv`
- **Processed data**: spatially thinned global subset target ~2–4M rows (full pipeline not yet run; dev sample of 2000 rows is live)
- **API prefix**: `/api/v1`
- **Working directory for backend code**: `backend/` — all `from app.xxx` imports assume cwd is `backend/`

### Python Environment

Use `D:/conda_env/conda_envs/devgis/python.exe` — the system `python` is ArcGIS Pro's environment and does not have the required packages.

### Starting the Server

```python
# Must set cwd to backend/ first — Chinese path in Windows requires explicit chdir
import os, subprocess
os.chdir(r'C:\Users\25316\Desktop\开发\大程\backend')
subprocess.Popen([
    r'D:/conda_env/conda_envs/devgis/python.exe', '-m', 'uvicorn',
    'app.main:app', '--host', '0.0.0.0', '--port', '8000'
])
```

Or from a terminal already in `backend/`:
```
D:/conda_env/conda_envs/devgis/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Note**: `http_proxy` is set in this environment (port 7897). When testing with curl, use `--noproxy localhost`. When testing with Python, unset `os.environ['http_proxy']` first.

---

## Directory Layout

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app, CORS, router registration
│   ├── config.py        # pydantic-settings Settings class, reads .env
│   ├── db.py            # engine, SessionLocal, get_db dependency
│   ├── deps.py          # shared FastAPI Depends
│   ├── models/          # SQLAlchemy ORM (table definitions)
│   │   ├── __init__.py
│   │   ├── occurrence.py   → class OccurrenceClean
│   │   ├── grid.py         → class OccurrenceGridMonthly
│   │   └── species.py      → class SpeciesLookup
│   ├── schemas/         # Pydantic request / response shapes
│   │   ├── __init__.py
│   │   ├── occurrence.py
│   │   ├── species.py
│   │   └── stats.py
│   ├── routers/         # FastAPI APIRouter — validate params, call service
│   │   ├── __init__.py
│   │   ├── occurrence.py
│   │   ├── species.py
│   │   ├── stats.py
│   │   └── geoserver.py
│   └── services/        # Business logic, raw SQL / PostGIS / HTTP calls
│       ├── __init__.py
│       ├── spatial.py
│       └── geoserver.py
├── scripts/
│   ├── init_db.sql         # Run once to create tables and indexes (idempotent)
│   ├── prepare_global.py   # Stream 15GB TSV → spatially thinned global_thinned.tsv
│   ├── import_to_pg.py     # Bulk import TSV → occurrence_clean + species_lookup
│   └── build_grid.py       # Aggregate occurrence_clean → occurrence_grid_monthly
├── test_data/
│   ├── cn_sample_records.tsv   # 500-row sample, tab-separated, UTF-8
│   ├── sample_summary.json
│   └── 数据概况.md
├── tests/
├── .env                 # Never commit. See .env.example for keys.
├── .env.example
├── docker-compose.yml
└── requirements.txt
```

---

## Environment Variables

All settings live in `backend/.env`. The `config.py` module exposes a `Settings` singleton. Required keys:

```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
GEOSERVER_URL          # http://localhost:8080/geoserver  (GeoServer 2.28.1)
GEOSERVER_USER, GEOSERVER_PASSWORD, GEOSERVER_WORKSPACE, GEOSERVER_DATASTORE
RAW_DATA_PATH          # D:/EBIRD/0009321-260519110011954.csv
APP_HOST, APP_PORT, DEBUG
```

Always read settings via `from app.config import settings`, never via `os.environ` directly.

---

## Database Schema

### Table: `occurrence_clean`

Primary table for individual bird observation records. ~1–2M rows (China-filtered) or full ~27M (global).

| Column | Type | Notes |
|--------|------|-------|
| `gbif_id` | BIGINT PK | from `gbifID` field |
| `species_key` | BIGINT | nullable; absent when record is genus-level |
| `taxon_key` | BIGINT | |
| `bird_order` | TEXT | |
| `family` | TEXT | |
| `genus` | TEXT | |
| `species` | TEXT | **nullable** — fall back to `scientific_name` for display |
| `scientific_name` | TEXT | always present |
| `country_code` | CHAR(2) | ISO 3166-1 alpha-2 |
| `state_province` | TEXT | e.g. "Beijing", "Zhejiang" |
| `locality` | TEXT | free-text location description |
| `individual_count` | INTEGER | **nullable** (~6% missing); never replace with 1 silently |
| `event_date` | DATE | |
| `year` | SMALLINT | always 2024 in current dataset |
| `month` | SMALLINT | 8–11 for migration season |
| `day` | SMALLINT | |
| `license` | TEXT | e.g. "CC_BY_4_0" |
| `issue` | TEXT | semicolon-separated GBIF quality flags |
| `geom` | geometry(Point, 4326) | ST_MakePoint(lon, lat), SRID 4326 |

**Indexes**: GIST on `geom`, B-tree on `(species_key)`, `(year, month)`, `(country_code, state_province)`.

### Table: `occurrence_grid_monthly`

Pre-aggregated grid cells for heatmap rendering. Built by `scripts/build_grid.py`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `year` | SMALLINT | |
| `month` | SMALLINT | |
| `grid_size` | REAL | cell edge in degrees: 1.0, 0.5, or 0.1 |
| `record_count` | INTEGER | number of observation records in cell |
| `individual_sum` | INTEGER | sum of individual_count (NULLs excluded) |
| `center_lon` | DOUBLE PRECISION | grid cell center |
| `center_lat` | DOUBLE PRECISION | |
| `geom` | geometry(Polygon, 4326) | grid cell polygon |

**Indexes**: B-tree on `(year, month)`, `(grid_size)`, GIST on `geom`.

### Table: `species_lookup`

One row per unique species. Used for search autocomplete and species cards.

| Column | Type | Notes |
|--------|------|-------|
| `species_key` | BIGINT PK | |
| `taxon_key` | BIGINT | |
| `bird_order` | TEXT | |
| `family` | TEXT | |
| `genus` | TEXT | |
| `species` | TEXT | |
| `scientific_name` | TEXT | |
| `record_count` | INTEGER | total records in occurrence_clean |

**Index**: GIN full-text index on `(species || ' ' || scientific_name)` for fast search.

---

## API Endpoints

All endpoints are prefixed `/api/v1`. All coordinate values use WGS-84 (EPSG:4326). All responses are JSON.

### Species: `/api/v1/species`

#### `GET /search`
Full-text search for autocomplete.

Query params:
- `q: str` — search string (min 2 chars)
- `limit: int = 10`

Response: `List[SpeciesItem]`
```json
[{"species_key": 1234, "species": "Motacilla alba", "scientific_name": "Motacilla alba Linnaeus, 1758", "family": "Motacillidae", "record_count": 450}]
```

#### `GET /{species_key}`
Full details for one species.

Response: `SpeciesItem`

#### `GET /rank`
Top-N species by record count. Used by ECharts bar chart.

Query params:
- `country_code: str | None` — filter by country
- `month: int | None` — 1–12
- `year: int = 2024`
- `limit: int = 20`

Response: `List[SpeciesRankItem]`
```json
[{"species_key": 1234, "species": "Motacilla alba", "record_count": 450, "individual_sum": 1200}]
```

---

### Occurrence: `/api/v1/occurrence`

#### `GET /points`
Returns occurrence points within a bounding box. Used when Cesium zoom ≥ 10.

Query params:
- `bbox: str` — `"minx,miny,maxx,maxy"` in WGS-84 degrees
- `species_key: int | None`
- `month: int | None`
- `year: int = 2024`
- `limit: int = 2000` — hard cap, never exceed 5000

Response: **GeoJSON FeatureCollection**
```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [116.4, 39.9]},
    "properties": {
      "gbif_id": 5461751131,
      "species": "Spilopelia chinensis",
      "individual_count": 1,
      "event_date": "2024-08-05",
      "locality": "绿堤公园",
      "country_code": "CN",
      "state_province": "Beijing"
    }
  }]
}
```

#### `POST /within`
Returns occurrence points within an arbitrary polygon. Used for map draw-select.

Request body:
```json
{
  "geometry": {"type": "Polygon", "coordinates": [...]},
  "species_key": 12345,
  "month": 9,
  "year": 2024,
  "limit": 2000
}
```

Response: GeoJSON FeatureCollection (same shape as `/points`).

PostGIS query uses `ST_Within(geom, ST_GeomFromGeoJSON(:geojson_str))`.

#### `GET /buffer`
Returns occurrence points within a radius of a clicked point.

Query params:
- `lat: float`, `lng: float` — center
- `radius_km: float` — search radius in kilometers
- `species_key: int | None`
- `month: int | None`
- `limit: int = 500`

PostGIS query uses `ST_DWithin(geom::geography, ST_MakePoint(:lng, :lat)::geography, :radius_m)`.

Response: GeoJSON FeatureCollection.

---

### Stats: `/api/v1/stats`

#### `GET /monthly`
Monthly record counts. Used by ECharts line chart.

Query params:
- `species_key: int | None`
- `country_code: str | None`
- `year: int = 2024`

Response:
```json
[{"month": 8, "record_count": 3420, "individual_sum": 8900}, ...]
```

#### `GET /province`
Province-level record counts for a country.

Query params:
- `country_code: str = "CN"`
- `month: int | None`
- `year: int = 2024`

Response:
```json
[{"state_province": "Beijing", "record_count": 1200}, ...]
```

#### `GET /grid`
Aggregated grid cells for medium-scale heatmap. Used when Cesium zoom 5–9.

Query params:
- `bbox: str` — `"minx,miny,maxx,maxy"`
- `grid_size: float = 1.0` — cell size in degrees
- `month: int | None`
- `year: int = 2024`
- `species_key: int | None`
- `max_cells: int = 10000`

Response: GeoJSON FeatureCollection. Each Feature's properties:
```json
{"record_count": 42, "individual_sum": 120, "center_lon": 116.5, "center_lat": 39.5}
```

Implementation: query `occurrence_grid_monthly` if `species_key` is None (fast). If `species_key` is set, run a live PostGIS aggregation on `occurrence_clean` using `ST_SnapToGrid`.

#### `GET /migration`
Per-month observation centroid for a species. Used for migration path visualization.

Query params:
- `species_key: int` — required
- `year: int = 2024`

Response:
```json
[{"month": 8, "center_lon": 116.4, "center_lat": 35.2, "record_count": 120}, ...]
```

PostGIS: `ST_AsText(ST_Centroid(ST_Collect(geom)))` grouped by month.

---

### GeoServer: `/api/v1/geoserver`

All endpoints call the GeoServer REST API via `services/geoserver.py`. The GeoServer base URL and credentials come from `settings`.

#### `GET /layers`
List all layers in `settings.GEOSERVER_WORKSPACE`.

#### `POST /layers`
Publish a PostGIS table as a new layer.

Request body:
```json
{"layer_name": "cn_grid_monthly_m8", "table_name": "occurrence_grid_monthly", "style_name": "heatmap_blue", "cql_filter": "month=8 AND year=2024"}
```

#### `DELETE /layers/{layer_name}`
Delete featureType and layer from GeoServer.

#### `PUT /layers/{layer_name}/style`
Switch the default style of an existing layer.

Request body: `{"style_name": "heatmap_red"}`

---

## Spatial Query Patterns

### Bounding box filter

```python
# services/spatial.py
from sqlalchemy import text

def bbox_filter(bbox_str: str):
    minx, miny, maxx, maxy = map(float, bbox_str.split(","))
    return text(
        "geom && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)"
    ).bindparams(minx=minx, miny=miny, maxx=maxx, maxy=maxy)
```

### Polygon within

```python
def within_filter(geojson_str: str):
    return text(
        "ST_Within(geom, ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326))"
    ).bindparams(geojson=geojson_str)
```

### Buffer (radius in km)

```python
def buffer_filter(lat: float, lng: float, radius_km: float):
    return text(
        "ST_DWithin(geom::geography, ST_MakePoint(:lng,:lat)::geography, :radius)"
    ).bindparams(lng=lng, lat=lat, radius=radius_km * 1000)
```

### Live grid aggregation (when species filter is active)

```sql
SELECT
  floor(ST_X(geom) / :grid_size) * :grid_size + :grid_size/2 AS center_lon,
  floor(ST_Y(geom) / :grid_size) * :grid_size + :grid_size/2 AS center_lat,
  count(*) AS record_count,
  sum(individual_count) AS individual_sum,
  ST_AsGeoJSON(
    ST_MakeEnvelope(
      floor(ST_X(geom) / :grid_size) * :grid_size,
      floor(ST_Y(geom) / :grid_size) * :grid_size,
      floor(ST_X(geom) / :grid_size) * :grid_size + :grid_size,
      floor(ST_Y(geom) / :grid_size) * :grid_size + :grid_size,
      4326
    )
  ) AS geom_json
FROM occurrence_clean
WHERE
  geom && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
  AND (:month IS NULL OR month = :month)
  AND (:species_key IS NULL OR species_key = :species_key)
GROUP BY center_lon, center_lat
LIMIT :max_cells
```

---

## Data Rules (Must Follow)

1. **`species` can be NULL** — when GBIF matched only to genus level (`TAXON_MATCH_HIGHERRANK`). Always display `scientific_name` as fallback; never crash on null `species`.

2. **`individual_count` can be NULL** — ~6% of records. For heatmap: count records, not individuals. For charts requiring individual count: filter to non-null and note the exclusion.

3. **Geometry insertion**: always use `ST_SetSRID(ST_MakePoint(lon, lat), 4326)`. Never insert raw WKT without SRID.

4. **Coordinate quality**: records with `COUNTRY_COORDINATE_MISMATCH` or `PRESUMED_SWAPPED_COORDINATE` in `issue` column are suspicious. Do not silently drop them but document any filtering decision.

5. **Point query hard limit**: never return more than 5000 points in a single API call. Default limit 2000.

6. **Grid query hard limit**: never return more than 10000 grid cells.

7. **Migration path**: do not describe as individual bird tracks. The data is observations, not GPS tracks. `/stats/migration` returns per-month centroids, not trajectories.

---

## GeoServer REST Client (`services/geoserver.py`)

```python
import requests
from app.config import settings

BASE = f"{settings.GEOSERVER_URL}/rest"
AUTH = (settings.GEOSERVER_USER, settings.GEOSERVER_PASSWORD)
WS   = settings.GEOSERVER_WORKSPACE

def list_layers() -> list[dict]: ...
def publish_layer(layer_name: str, table_name: str, style_name: str) -> None: ...
def delete_layer(layer_name: str) -> None: ...
def set_layer_style(layer_name: str, style_name: str) -> None: ...
```

Key GeoServer REST endpoints used:
- `GET  /workspaces/{ws}/featuretypes.json`
- `POST /workspaces/{ws}/datastores/birdscope_pg/featuretypes`
- `DELETE /workspaces/{ws}/featuretypes/{name}?recurse=true`
- `PUT  /workspaces/{ws}/layers/{name}`

The datastore `birdscope_pg` must exist in GeoServer before publishing layers (create manually once in GeoServer web UI, pointing to the PostGIS DB).

---

## Data Pipeline Scripts

### `scripts/init_db.sql`
Idempotent DDL. Run with `psql -d birdscope -f scripts/init_db.sql`.

### `scripts/prepare_global.py`
Reads the full 15 GB TSV at `D:/EBIRD/0009321-260519110011954.csv` in streaming mode (`csv.DictReader` with `delimiter="\t"`). **Never load the whole file into memory.**

**Spatial thinning strategy** (key design decision):
For each `(round(lon, 1), round(lat, 1), species_key, month)` tuple, keep only the record with the highest `gbifID`. This reduces ~27M rows to ~2–4M globally distributed records. Maintain a `seen: dict[tuple, str]` in memory (key = 4-tuple, value = output row). Estimated memory: ~800MB for 4M entries.

If memory is a concern, process month-by-month (4 passes over the file) instead of one pass.

Required columns to keep:
`gbifID, speciesKey, taxonKey, order, family, genus, species, scientificName, countryCode, stateProvince, locality, individualCount, decimalLatitude, decimalLongitude, eventDate, year, month, day, license, issue`

Rows to drop: missing `decimalLatitude` or `decimalLongitude`; non-numeric coordinates; `basisOfRecord != HUMAN_OBSERVATION`.

Outputs:
- `backend/data/global_thinned.tsv` — thinned occurrence records
- `backend/data/species_lookup.tsv` — one row per unique species_key

### `scripts/import_to_pg.py`
Bulk-insert `global_thinned.tsv` into `occurrence_clean` and `species_lookup.tsv` into `species_lookup`. Use `psycopg2.copy_expert` (fastest method) or SQLAlchemy Core bulk insert in batches of 10,000. Must handle NULL for `species`, `individual_count`, etc.

After import, update `species_lookup.record_count` with:
```sql
UPDATE species_lookup s
SET record_count = (SELECT count(*) FROM occurrence_clean o WHERE o.species_key = s.species_key);
```

### `scripts/build_grid.py`
Generates `occurrence_grid_monthly` from `occurrence_clean`:

```sql
INSERT INTO occurrence_grid_monthly (year, month, grid_size, record_count, individual_sum, center_lon, center_lat, geom)
SELECT
  year, month, 1.0 AS grid_size,
  count(*) AS record_count,
  sum(individual_count) AS individual_sum,
  floor(ST_X(geom)) + 0.5 AS center_lon,
  floor(ST_Y(geom)) + 0.5 AS center_lat,
  ST_MakeEnvelope(floor(ST_X(geom)), floor(ST_Y(geom)), floor(ST_X(geom))+1, floor(ST_Y(geom))+1, 4326) AS geom
FROM occurrence_clean
GROUP BY year, month, floor(ST_X(geom)), floor(ST_Y(geom));
```

Run after full import. Takes ~10 minutes on 1M rows.

---

## Response Schema Reference

### `SpeciesItem`
```python
class SpeciesItem(BaseModel):
    species_key: int
    species: str | None
    scientific_name: str
    bird_order: str | None
    family: str | None
    record_count: int
```

### `OccurrenceFeatureProperties`
```python
class OccurrenceFeatureProperties(BaseModel):
    gbif_id: int
    species: str | None
    scientific_name: str
    individual_count: int | None
    event_date: date
    locality: str | None
    country_code: str
    state_province: str | None
```

### `MonthlyTrendItem`
```python
class MonthlyTrendItem(BaseModel):
    month: int
    record_count: int
    individual_sum: int | None
```

### `GridFeatureProperties`
```python
class GridFeatureProperties(BaseModel):
    record_count: int
    individual_sum: int | None
    center_lon: float
    center_lat: float
```

---

## Test Data

**Primary dev sample: `backend/test_data/dev_sample.tsv`**
- 2000 rows, tab-separated, UTF-8
- All 20 columns matching `occurrence_clean` exactly
- 10 countries (AU, IN, GB, BR, CN, TW, ZA, DE, CO, AR) × 4 months (8–11) × 50 rows each
- 29 rows with null `species` (tests fallback to `scientific_name`)
- 108 rows with null `individual_count` (tests NULL handling)
- Use this as the primary dataset for pipeline and API development

**Legacy: `backend/test_data/cn_sample_records.tsv`**
- 500 rows, China only, 10 columns — do not use for new development

---

## Common Mistakes to Avoid

| Mistake | Correct approach |
|---------|-----------------|
| `open(path)` without encoding | `open(path, encoding='utf-8')` |
| Treating missing `species` as error | Fallback to `scientific_name` |
| Filling NULL `individual_count` with 1 | Leave as NULL, handle in query |
| Forgetting SRID in ST_MakePoint | Always `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` |
| Returning all matched points (no limit) | Always apply LIMIT, hard cap 5000 |
| Calling GeoServer before workspace/datastore exists | Check GeoServer setup first |
| Using `os.environ` directly | Use `from app.config import settings` |
| Parsing bbox inside routers | Parse in `services/spatial.py`, validate in schema |

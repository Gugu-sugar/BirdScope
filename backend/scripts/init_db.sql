-- BirdScope 数据库初始化脚本（幂等，可重复运行）
-- 执行前确保已 \c birdscope 并安装 PostGIS 扩展

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. occurrence_clean  明细点表
-- ============================================================
CREATE TABLE IF NOT EXISTS occurrence_clean (
    gbif_id          BIGINT PRIMARY KEY,
    species_key      BIGINT,
    taxon_key        BIGINT,
    bird_order       TEXT,
    family           TEXT,
    genus            TEXT,
    species          TEXT,
    scientific_name  TEXT,
    country_code     CHAR(2),
    state_province   TEXT,
    locality         TEXT,
    individual_count INTEGER,
    event_date       DATE,
    year             SMALLINT,
    month            SMALLINT,
    day              SMALLINT,
    license          TEXT,
    issue            TEXT,
    geom             geometry(Point, 4326)
);

CREATE INDEX IF NOT EXISTS occ_geom_idx    ON occurrence_clean USING GIST (geom);
CREATE INDEX IF NOT EXISTS occ_species_idx ON occurrence_clean (species_key);
CREATE INDEX IF NOT EXISTS occ_time_idx    ON occurrence_clean (year, month);
CREATE INDEX IF NOT EXISTS occ_country_idx ON occurrence_clean (country_code, state_province);

-- ============================================================
-- 2. occurrence_grid_monthly  全球聚合热力表
-- ============================================================
CREATE TABLE IF NOT EXISTS occurrence_grid_monthly (
    id             SERIAL PRIMARY KEY,
    year           SMALLINT        NOT NULL,
    month          SMALLINT        NOT NULL,
    grid_size      REAL            NOT NULL,
    record_count   INTEGER         NOT NULL,
    individual_sum INTEGER,
    center_lon     DOUBLE PRECISION,
    center_lat     DOUBLE PRECISION,
    geom           geometry(Polygon, 4326)
);

CREATE INDEX IF NOT EXISTS grid_time_idx ON occurrence_grid_monthly (year, month);
CREATE INDEX IF NOT EXISTS grid_size_idx ON occurrence_grid_monthly (grid_size);
CREATE INDEX IF NOT EXISTS grid_geom_idx ON occurrence_grid_monthly USING GIST (geom);
-- 复合索引：/stats/grid 预聚合路径与时间滑块逐月取数（grid_size + 时间维度）
CREATE INDEX IF NOT EXISTS grid_size_time_idx ON occurrence_grid_monthly (grid_size, year, month);

-- ============================================================
-- 3. species_lookup  物种索引表
-- ============================================================
CREATE TABLE IF NOT EXISTS species_lookup (
    species_key     BIGINT PRIMARY KEY,
    taxon_key       BIGINT,
    bird_order      TEXT,
    family          TEXT,
    genus           TEXT,
    species         TEXT,
    scientific_name TEXT,
    record_count    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS species_fts_idx ON species_lookup USING GIN (
    to_tsvector('simple',
        coalesce(species, '') || ' ' || coalesce(scientific_name, ''))
);

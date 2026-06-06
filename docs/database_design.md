# BirdScope 数据库设计

> 来源整合：AGENT.md DB Schema、BirdScope_后端开发方案.md 第四节  
> 最后更新：2026-06-06

数据库名：`birdscope`（PostgreSQL 16 + PostGIS 3.4）

---

## 三张核心表

```
occurrence_clean          → 明细点表（目标 200–400 万条）
occurrence_grid_monthly   → 预聚合热力网格表（build_grid.py 生成）
species_lookup            → 物种索引表（一行一物种）
```

---

## occurrence_clean（观测明细点表）

存放清洗后的全球鸟类观测记录。目标规模：空间降采样后约 200–400 万条。

```sql
CREATE TABLE IF NOT EXISTS occurrence_clean (
  gbif_id          BIGINT PRIMARY KEY,       -- 来自 GBIF gbifID 字段
  species_key      BIGINT,                   -- 可空：属级记录无此字段
  taxon_key        BIGINT,
  bird_order       TEXT,
  family           TEXT,
  genus            TEXT,
  species          TEXT,                     -- 可空；空时展示 scientific_name
  scientific_name  TEXT,                     -- 始终存在
  country_code     CHAR(2),                  -- ISO 3166-1 alpha-2
  state_province   TEXT,
  locality         TEXT,
  individual_count INTEGER,                  -- 可空（约 6% 缺失）；不填充为 1
  event_date       DATE,
  year             SMALLINT,                 -- 当前数据集全为 2024
  month            SMALLINT,                 -- 迁徙季：8–11
  day              SMALLINT,
  license          TEXT,                     -- 如 CC_BY_4_0
  issue            TEXT,                     -- 分号分隔的 GBIF 质量标记
  geom             geometry(Point, 4326)     -- ST_SetSRID(ST_MakePoint(lon,lat),4326)
);

-- 索引
CREATE INDEX IF NOT EXISTS occ_geom_idx    ON occurrence_clean USING GIST (geom);
CREATE INDEX IF NOT EXISTS occ_species_idx ON occurrence_clean (species_key);
CREATE INDEX IF NOT EXISTS occ_time_idx    ON occurrence_clean (year, month);
CREATE INDEX IF NOT EXISTS occ_country_idx ON occurrence_clean (country_code, state_province);
```

**关键约束说明：**
- `species` 可为 NULL（记录只匹配到属级，对应 GBIF issue `TAXON_MATCH_HIGHERRANK`）
- `individual_count` 可为 NULL（约 6%）；热力图按记录数统计，不要用 1 填充
- geometry 插入必须指定 SRID：`ST_SetSRID(ST_MakePoint(lon, lat), 4326)`
- `issue` 字段中含 `COUNTRY_COORDINATE_MISMATCH` 或 `PRESUMED_SWAPPED_COORDINATE` 的记录坐标可疑，不可静默删除，须记录过滤决策

---

## occurrence_grid_monthly（月度网格聚合热力表）

由 `scripts/build_grid.py` 从 `occurrence_clean` 生成。支撑全球小比例尺热力图（GeoServer WMS + FastAPI `/stats/grid`）。

```sql
CREATE TABLE IF NOT EXISTS occurrence_grid_monthly (
  id             SERIAL PRIMARY KEY,
  year           SMALLINT,
  month          SMALLINT,
  grid_size      REAL,              -- 网格边长（度）：1.0 / 0.5 / 0.1
  record_count   INTEGER,
  individual_sum INTEGER,           -- NULL 值不计入
  center_lon     DOUBLE PRECISION,
  center_lat     DOUBLE PRECISION,
  geom           geometry(Polygon, 4326)   -- 网格格子多边形
);

CREATE INDEX IF NOT EXISTS grid_time_idx ON occurrence_grid_monthly (year, month);
CREATE INDEX IF NOT EXISTS grid_size_idx ON occurrence_grid_monthly (grid_size);
CREATE INDEX IF NOT EXISTS grid_geom_idx ON occurrence_grid_monthly USING GIST (geom);
```

**聚合 SQL（1 度网格）**：
```sql
INSERT INTO occurrence_grid_monthly (year, month, grid_size, record_count, individual_sum, center_lon, center_lat, geom)
SELECT
  year, month, 1.0 AS grid_size,
  count(*) AS record_count,
  sum(individual_count) AS individual_sum,
  floor(ST_X(geom)) + 0.5 AS center_lon,
  floor(ST_Y(geom)) + 0.5 AS center_lat,
  ST_MakeEnvelope(floor(ST_X(geom)), floor(ST_Y(geom)),
                  floor(ST_X(geom))+1, floor(ST_Y(geom))+1, 4326) AS geom
FROM occurrence_clean
GROUP BY year, month, floor(ST_X(geom)), floor(ST_Y(geom));
```

约 10 分钟完成（100 万行）。

**已知局限**：预聚合表不含 `species_key` 维度，全球视角 + 物种筛选时只能降级到 FastAPI 实时聚合。这是一周交付压力下有意识的 scope 取舍，长期可补充物种维度预计算。

---

## species_lookup（物种索引表）

一行一物种，用于搜索框自动补全和物种卡片。

```sql
CREATE TABLE IF NOT EXISTS species_lookup (
  species_key     BIGINT PRIMARY KEY,
  taxon_key       BIGINT,
  bird_order      TEXT,
  family          TEXT,
  genus           TEXT,
  species         TEXT,
  scientific_name TEXT,
  record_count    INTEGER            -- 来自 occurrence_clean 的记录总数
);

-- GIN 全文索引：支持物种名搜索框
CREATE INDEX IF NOT EXISTS species_fts_idx ON species_lookup USING GIN (
  to_tsvector('simple',
    coalesce(species, '') || ' ' || coalesce(scientific_name, ''))
);
```

导入后更新 `record_count`：
```sql
UPDATE species_lookup s
SET record_count = (
  SELECT count(*) FROM occurrence_clean o WHERE o.species_key = s.species_key
);
```

---

## 潜在优化索引（全量数据后评估）

```sql
-- 如果 /stats/grid?species_key=xxx 响应超 1s，加此索引
CREATE INDEX IF NOT EXISTS occ_species_time_idx
  ON occurrence_clean (species_key, year, month);
```

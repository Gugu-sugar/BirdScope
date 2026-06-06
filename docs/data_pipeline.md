# BirdScope 数据处理流程

> 来源整合：AGENT.md 数据管道章节、BirdScope_后端开发方案.md 第七节、BirdScope_数据使用方案.md  
> 最后更新：2026-06-06

---

## 全流程概览

```
D:/EBIRD/0009321-260519110011954.csv（15GB TSV，约 2765 万条）
    │
    ▼ scripts/prepare_global.py（流式读取，空间降采样）
    │
    ├──▶ backend/data/global_thinned.tsv（约 200–400MB，200–400 万条）
    └──▶ backend/data/species_lookup.tsv（物种索引，一行一物种）
    │
    ▼ scripts/import_to_pg.py（批量导入）
    │
    ├──▶ occurrence_clean（明细点表）
    └──▶ species_lookup（物种索引表）
    │
    ▼ scripts/build_grid.py（聚合）
    │
    └──▶ occurrence_grid_monthly（预聚合热力网格）
```

---

## 原始数据说明

| 属性 | 值 |
|------|-----|
| 文件路径 | `D:/EBIRD/0009321-260519110011954.csv` |
| 实际格式 | UTF-8，制表符分隔（扩展名虽为 .csv，实为 TSV）|
| 文件大小 | 约 15GB |
| 估计行数 | 约 2765 万条 |
| 字段数 | 50 个（GBIF Darwin Core occurrence 格式）|
| 数据特征 | 全为 `HUMAN_OBSERVATION`；年份全为 2024；8–11 月迁徙季 |

**读取注意**：必须用 `csv.DictReader(f, delimiter="\t")`，且 `open(path, encoding='utf-8')`。

---

## 空间降采样策略（prepare_global.py）

### 为什么要降采样

2765 万条点数据无法全量导入 PostGIS 做实时点查询（内存和查询性能均不可行）。目标：降至 200–400 万条，同时保持全球均匀覆盖。

### 降采样逻辑

**核心键**：`(round(lon, 1), round(lat, 1), species_key, month)`

对每个四元组（0.1°×0.1° 空间格子 × 物种 × 月份），只保留 `gbif_id` 最大的一条记录。

- 内存中维护一个 `seen: dict[tuple, row]`（键为上述四元组，值为当前最优行）
- 峰值内存估算：约 800MB（4M 条目），需要开发机可用内存 > 1.5GB
- 如果内存不足：改为按月份分批处理（4次单月扫描）

**丢弃规则**：
- `decimalLatitude` 或 `decimalLongitude` 为空
- 坐标无法解析为数字
- `basisOfRecord != HUMAN_OBSERVATION`

**保留字段（20 列）**：
`gbifID, speciesKey, taxonKey, order, family, genus, species, scientificName, countryCode, stateProvince, locality, individualCount, decimalLatitude, decimalLongitude, eventDate, year, month, day, license, issue`

**选取 max(gbif_id) 的局限**：语义上等同于"最晚录入的记录"，非"数据质量最高的记录"。这是一周交付压力下的有意取舍（技术债）。

### 输出

- `backend/data/global_thinned.tsv` — 降采样后的观测记录（与 occurrence_clean 字段对应）
- `backend/data/species_lookup.tsv` — 唯一物种列表

---

## 批量导入（import_to_pg.py）

使用 `psycopg2.copy_expert`（COPY 协议）或 SQLAlchemy Core 批量写入（每批 10,000 条）。COPY 比 INSERT 快 10–50 倍。

**必须处理的 NULL**：`species`、`individual_count`、`species_key`、`bird_order` 等均可能为空，不能写死非空约束。

导入后更新 species_lookup 的 record_count：
```sql
UPDATE species_lookup s
SET record_count = (SELECT count(*) FROM occurrence_clean o WHERE o.species_key = s.species_key);
```

---

## 网格聚合（build_grid.py）

从 `occurrence_clean` 生成 `occurrence_grid_monthly`：

```sql
INSERT INTO occurrence_grid_monthly (year, month, grid_size, record_count, individual_sum, center_lon, center_lat, geom)
SELECT
  year, month, 1.0 AS grid_size,
  count(*) AS record_count,
  sum(individual_count) AS individual_sum,
  floor(ST_X(geom)) + 0.5 AS center_lon,
  floor(ST_Y(geom)) + 0.5 AS center_lat,
  ST_MakeEnvelope(
    floor(ST_X(geom)), floor(ST_Y(geom)),
    floor(ST_X(geom))+1, floor(ST_Y(geom))+1, 4326
  ) AS geom
FROM occurrence_clean
GROUP BY year, month, floor(ST_X(geom)), floor(ST_Y(geom));
```

100 万行约 10 分钟。后续可补充 0.5 度和 0.1 度网格（同一 `grid_size` 字段区分）。

---

## 当前测试数据

| 文件 | 说明 | 状态 |
|------|------|------|
| `backend/test_data/dev_sample.tsv` | 2000 行，10 国，20 列，含 NULL 边界情况，当前主要测试数据 | ✅ 已导入 |
| `backend/test_data/dev_sample_info.md` | 测试数据详细说明 | — |

旧版 `cn_sample_records.tsv`（500 行，仅中国，10 列）已废弃，不用于新开发。

---

## 数据质量提醒

- `COUNTRY_COORDINATE_MISMATCH`、`PRESUMED_SWAPPED_COORDINATE` 标记的记录坐标可疑，不可静默删除，须记录过滤决策
- `COORDINATE_ROUNDED` 表示坐标经四舍五入处理
- `TAXON_MATCH_HIGHERRANK` 对应 `species` 为空的记录
- 许可字段为 `CC_BY_4_0`，发布结果须保留来源归属

# BirdScope 数据处理流程

> 最后更新：2026-06-08

---

## 全流程概览

```
D:/EBIRD/0009321-260519110011954.csv（15GB，约 2762 万条，5 大洲）
    │
    ▼ scripts/prepare_global.py（DuckDB，两步降采样，约 30–50 分钟）
    │
    ├──▶ backend/data/global_thinned.tsv（约 300–410 万条，含表头）
    │
D:/EBIRD/North Amarica/0011005-260519110011954.csv（21.8GB，约 4380 万条）
    │
    ▼ scripts/prepare_north_america.py（DuckDB，两步降采样，约 30–50 分钟）
    │
    ├──▶ backend/data/na_thinned.tsv（约 90 万条，无表头）
    │
    ▼ 合并（PowerShell）
    │   Get-Content backend\data\na_thinned.tsv | Add-Content backend\data\global_thinned.tsv
    │
    ▼ scripts/import_to_pg.py --input backend/data/global_thinned.tsv（约 20–30 分钟）
    │
    ├──▶ occurrence_clean（明细点表）
    └──▶ species_lookup（物种索引表）
    │
    ▼ scripts/build_grid.py（约 10 分钟）
    │
    └──▶ occurrence_grid_monthly（预聚合热力网格）
```

---

## 原始数据说明

| 属性 | 全球文件 | 北美文件 |
|------|---------|---------|
| 文件路径 | `D:/EBIRD/0009321-260519110011954.csv` | `D:/EBIRD/North Amarica/0011005-260519110011954.csv` |
| 实际格式 | UTF-8，制表符分隔（扩展名 .csv，实为 TSV）| 同左 |
| 文件大小 | 约 15GB | 约 21.8GB |
| 估计行数 | 约 2762 万条 | 约 4380 万条 |
| 字段数 | 50 个（GBIF Darwin Core occurrence 格式）| 同左 |
| 覆盖大洲 | 非洲、亚洲、大洋洲、欧洲、南美洲 | 北美洲（美国、加拿大为主） |

**读取注意**：必须用 `read_csv(path, delim='\t', header=true, nullstr='', ignore_errors=true)`（DuckDB），或 Python 中 `csv.DictReader(f, delimiter="\t")` + `open(path, encoding='utf-8')`。

---

## 两步降采样策略

### 为什么需要两步

eBird 在北美洲的活跃用户密度远高于其他大洲，直接导致：
- 北美原始记录密度（1.77 条/km²）是非洲（0.06 条/km²）的 **29 倍**
- 若单步 0.1° 网格去重，北美仍约占最终数据集的 60%，严重影响全球热力图对比效果

科学依据：Inman et al. (2021) *Ecosphere*；Boakes et al. (2010) *PLoS ONE*；GeoThinneR (2025)

---

### Step 1：空间聚集去偏（0.1°×0.1° 网格去重）

**去重键**：`(round(lon, 1), round(lat, 1), speciesKey, month)`

对每个四元组（0.1°×0.1° 格子 × 物种 × 月份），只保留 `gbifID` 最大（最晚录入）的一条记录。

**丢弃规则**：
- `decimalLatitude` 或 `decimalLongitude` 为空
- 坐标无法解析
- `basisOfRecord != HUMAN_OBSERVATION`

**注意**：选取 max(gbifID) 语义上等同于"最晚录入的记录"，非"数据质量最高"，属于有意的工程取舍。

---

### Step 2：大洲面积配额子采样

各大洲最终记录数与其陆地面积成正比，使全球热力图密度可比。

**面积配额（总目标 500 万条）**：

| 大洲 | 陆地面积（万km²） | 面积占比 | 配额 | 原始条目 | 脚本 |
|------|----------------|---------|------|---------|------|
| 非洲 | 3037 | 22.24% | 111万 | 183万 | prepare_global.py |
| 亚洲 | 4458 | 32.65% | 163万 | 642万 | prepare_global.py |
| 大洋洲 | 852 | 6.24% | 31万 | 410万 | prepare_global.py |
| 欧洲 | 1053 | 7.71% | 39万 | 773万 | prepare_global.py |
| 南美洲 | 1784 | 13.07% | 65万 | 754万 | prepare_global.py |
| **北美洲** | **2471** | **18.09%** | **90万** | **4380万** | **prepare_north_america.py** |
| 合计 | 13655 | 100% | 500万 | 7142万 | — |

**规则**：若某大洲 Step 1 输出 ≤ 配额，全部保留（不强制删减低密度区数据）。

**北美额外措施**：按 10° 纬度带（20°–30°N, 30°–40°N, …, 60°–75°N）分层随机，保证高纬稀疏区（加拿大北部、阿拉斯加）不被全局采样率清空。

**`prepare_global.py` 大洲识别**：通过 `countryCode`（ISO 3166-1 alpha-2）→ 大洲的硬编码字典实现，覆盖约 150 个国家码。未匹配的国家码记录全部保留。

---

### 输出

| 文件 | 格式 | 内容 |
|------|------|------|
| `backend/data/global_thinned.tsv` | TSV，**含表头**，20 列 | 非北美大洲降采样结果；合并后追加 na_thinned.tsv |
| `backend/data/na_thinned.tsv` | TSV，**无表头**，20 列 | 北美洲降采样结果，需 cat 追加至 global_thinned.tsv |
| `backend/data/species_lookup.tsv` | TSV，含表头 | 由 import_to_pg.py 生成 |

**保留字段（20 列）**：
`gbifID, speciesKey, taxonKey, order, family, genus, species, scientificName, countryCode, stateProvince, locality, individualCount, decimalLatitude, decimalLongitude, eventDate, year, month, day, license, issue`

---

## 批量导入（import_to_pg.py）

合并后使用 `psycopg2` 批量写入，每批 500 条，`ON CONFLICT (gbif_id) DO NOTHING` 防重复。

```powershell
# 1. 运行两个降采样脚本
cd backend
D:/conda_env/conda_envs/devgis/python.exe scripts/prepare_global.py
D:/conda_env/conda_envs/devgis/python.exe scripts/prepare_north_america.py

# 2. 合并文件
Get-Content data\na_thinned.tsv | Add-Content data\global_thinned.tsv

# 3. 导入数据库（需先在 backend-docs/human_review.md 提交审批）
D:/conda_env/conda_envs/devgis/python.exe scripts/import_to_pg.py --input data/global_thinned.tsv
```

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

---

## 数据质量提醒

- `COUNTRY_COORDINATE_MISMATCH`、`PRESUMED_SWAPPED_COORDINATE` 标记的记录坐标可疑，不可静默删除，须记录过滤决策
- `COORDINATE_ROUNDED` 表示坐标经四舍五入处理
- `TAXON_MATCH_HIGHERRANK` 对应 `species` 为空的记录
- 许可字段为 `CC_BY_4_0`，发布结果须保留来源归属

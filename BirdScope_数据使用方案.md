# BirdScope 数据使用方案

## 1. 和开题报告目标的对应关系

开题报告目标是“全球观鸟地图平台”，数据应分成四层使用，而不是把 15GB 原始 TSV 直接接到前端。

| 平台功能 | 建议数据形态 | 对应字段 |
|---|---|---|
| 全球热力图 | 按月份 + 网格聚合后的表或栅格 | `decimalLatitude`, `decimalLongitude`, `month`, `individualCount` |
| 区域聚合 | 行政区/网格/六边形聚合表 | `countryCode`, `stateProvince`, 坐标, `species` |
| 局部矢量点 | 过滤后的 occurrence 点图层 | `gbifID`, `species`, `eventDate`, 坐标 |
| 多维查询 | PostGIS 明细表 + 索引 | 物种、时间、空间、国家/省份 |
| 时间滑块动画 | 分月预聚合数据 | `year`, `month`, 坐标聚合 |
| ECharts 图表 | 统计结果表/API | 物种排行、月度趋势、区域统计 |
| 物种信息卡片 | 物种索引表 | `speciesKey`, `taxonKey`, `scientificName`, `family` |

## 2. 推荐的数据分层

### A. 原始层 raw

保存原始 `0009321-260519110011954.csv`，只作为可追溯源数据，不直接查询。

特点：

- 约 15.08GB。
- 实际是 UTF-8 制表符分隔 TSV。
- 字段是 GBIF/Darwin Core occurrence 结构。

### B. 清洗层 clean_occurrence

从原始数据中抽取平台真正需要的字段：

`gbifID`, `speciesKey`, `taxonKey`, `order`, `family`, `genus`, `species`, `scientificName`, `countryCode`, `stateProvince`, `locality`, `individualCount`, `decimalLatitude`, `decimalLongitude`, `eventDate`, `year`, `month`, `day`, `basisOfRecord`, `license`, `issue`

清洗规则建议：

- 保留 `basisOfRecord = HUMAN_OBSERVATION`。
- 保留经纬度非空且可解析为数字的记录。
- 先保留 `issue` 字段，不要一开始全部删除；后续按分析场景过滤。
- `individualCount` 缺失时，做热力图可暂按 1 条记录计数；做数量分析时必须单独说明缺失。
- `species` 为空时用 `scientificName` 展示，但物种级统计应标记为“未精确到种”。

### C. 服务层 map/stat

为平台准备几类派生数据：

| 派生数据 | 用途 |
|---|---|
| `global_grid_monthly` | Cesium 全球热力图、时间滑块 |
| `country_grid_monthly` | 中尺度区域聚合 |
| `occurrence_points` | 局部缩放后的点查询、弹窗 |
| `species_rank` | 物种排行图 |
| `month_counts` | 月度趋势图 |
| `species_lookup` | 物种搜索框和信息卡片 |

## 3. PostGIS 表设计建议

### 明细点表

```sql
CREATE TABLE occurrence_clean (
  gbif_id BIGINT PRIMARY KEY,
  species_key BIGINT,
  taxon_key BIGINT,
  bird_order TEXT,
  family TEXT,
  genus TEXT,
  species TEXT,
  scientific_name TEXT,
  country_code TEXT,
  state_province TEXT,
  locality TEXT,
  individual_count INTEGER,
  event_date DATE,
  year INTEGER,
  month INTEGER,
  day INTEGER,
  license TEXT,
  issue TEXT,
  geom geometry(Point, 4326)
);
```

推荐索引：

```sql
CREATE INDEX occurrence_clean_geom_idx ON occurrence_clean USING GIST (geom);
CREATE INDEX occurrence_clean_species_idx ON occurrence_clean (species_key);
CREATE INDEX occurrence_clean_time_idx ON occurrence_clean (year, month);
CREATE INDEX occurrence_clean_country_idx ON occurrence_clean (country_code, state_province);
```

### 月度网格聚合表

```sql
CREATE TABLE occurrence_grid_monthly (
  year INTEGER,
  month INTEGER,
  grid_size DOUBLE PRECISION,
  record_count INTEGER,
  individual_sum INTEGER,
  geom geometry(Polygon, 4326)
);
```

这张表更适合 GeoServer 发布 WMS，用于全球热力图和月份动画。

## 4. GeoServer / FastAPI / 前端怎么分工

### GeoServer

适合发布稳定、重绘频繁的地图层：

- `global_grid_monthly`：WMS 热力图或分级设色图。
- `country_grid_monthly`：中尺度聚合图。
- `occurrence_points`：局部 WFS 点图层，但只建议在缩放到足够大时启用。

### FastAPI

适合做业务查询和统计：

- 物种搜索。
- 时间范围查询。
- 框选/缓冲区查询。
- 返回 ECharts 所需统计。
- 控制 GeoServer 图层发布、样式切换。

### React + Cesium

前端只负责展示和交互：

- 小比例尺加载 WMS 聚合图。
- 大比例尺调用 API/WFS 获取点。
- 时间滑块切换月份图层或请求不同月份数据。
- ECharts 接收 API 返回的统计 JSON。

## 5. 当前已做的小样本试用

新增脚本：

```powershell
python .\birdscope_prepare_sample.py .\0009321-260519110011954.csv --rows 200000 --country CN --year 2024 --months 8,9,10,11
```

输出目录：

`birdscope_sample_outputs`

主要输出：

| 文件 | 作用 |
|---|---|
| `global_grid_1deg_monthly.tsv` | 前 20 万行的全球 1 度网格月度聚合，可模拟全球热力层 |
| `cn_grid_1deg_monthly.tsv` | 中国 1 度网格月度聚合 |
| `cn_points_sample.geojson` | 中国点样例，可直接给 Cesium/Leaflet/OpenLayers 测试 |
| `cleaned_cn_2024_m8-9-10-11.tsv` | 中国清洗后明细样本 |
| `cn_species_rank.tsv` | 中国样本物种排行 |
| `cn_province_counts.tsv` | 中国样本省级统计 |
| `species_lookup.tsv` | 物种索引样本 |

## 6. 项目阶段建议

第一阶段不要马上处理全球全量 15GB。建议按这个顺序推进：

1. 用当前 20 万行样本打通前后端：GeoJSON 点、网格热力、物种排行、时间滑块。
2. 扩大到中国区域全量：从 15GB 中只过滤 `countryCode = CN`，导入 PostGIS。
3. 再做全球聚合层：全量扫描一次，只生成月度网格表，不保留所有全球点到前端。
4. 最后再考虑迁徙路径：选择少数候鸟物种，按月份重心或热点连线，而不是直接追踪个体。

## 7. 迁徙路径的现实限制

这份 GBIF/eBird occurrence 数据是观测点集合，不是带个体 ID 的追踪数据。因此“迁徙路径”更适合做成：

- 某物种不同月份观测热点变化。
- 按月计算观测重心并连线。
- 按纬度/经度随时间变化展示迁徙趋势。

不建议表述为“单只鸟的迁徙轨迹”，因为数据本身不支持。

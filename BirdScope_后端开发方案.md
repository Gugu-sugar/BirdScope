# BirdScope 后端开发方案

> 版本：v1.2 | 日期：2026-06-05 | 作者：后端负责人

---

## 一、方案定位

本文档面向后端独立开发者，覆盖从数据导入到 API 上线的完整路径。目标是用 **FastAPI + PostGIS + GeoServer 2.28.1** 支撑前端 Cesium 三维地图的所有数据需求，**一周内**完成 API 可用状态。

### 当前进度（2026-06-05）

| 阶段 | 状态 |
|------|------|
| 目录结构 + 三层架构代码 | ✅ 完成 |
| 数据库建表（3张表 + 索引）| ✅ 完成 |
| dev_sample.tsv 导入（2000条全球样本）| ✅ 完成 |
| 全部 API 接口（occurrence / species / stats / geoserver）| ✅ 完成 |
| FastAPI 服务启动、/docs 可访问 | ✅ 完成 |
| 全量数据处理（prepare_global.py → import）| ⏳ 待做（第4天）|
| 热力聚合表 build_grid.py | ⏳ 待做（第4天）|
| GeoServer 图层发布 | ⏳ 待做（第5天）|

---

## 二、目录结构（调整后）

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI 应用入口，注册路由、CORS、启动事件
│   ├── config.py             # 读取 .env，暴露 Settings 单例
│   ├── db.py                 # SQLAlchemy engine + SessionLocal + get_db 依赖
│   ├── deps.py               # 公用 FastAPI Depends（DB session、鉴权占位）
│   ├── models/               # SQLAlchemy ORM 模型（对应数据库表）
│   │   ├── __init__.py
│   │   ├── occurrence.py     # OccurrenceClean
│   │   ├── grid.py           # OccurrenceGridMonthly
│   │   └── species.py        # SpeciesLookup
│   ├── schemas/              # Pydantic 请求/响应模型
│   │   ├── __init__.py
│   │   ├── occurrence.py     # OccurrencePoint, OccurrenceGeoJSON…
│   │   ├── species.py        # SpeciesItem, SpeciesSearchResult…
│   │   └── stats.py          # MonthlyTrend, ProvinceStats, GridCell…
│   ├── routers/              # 路由层，只做参数校验和调用 service
│   │   ├── __init__.py
│   │   ├── occurrence.py     # /api/v1/occurrence/*
│   │   ├── species.py        # /api/v1/species/*
│   │   ├── stats.py          # /api/v1/stats/*
│   │   └── geoserver.py      # /api/v1/geoserver/*
│   └── services/             # 业务逻辑层，PostGIS 查询和外部调用放这里
│       ├── __init__.py
│       ├── spatial.py        # ST_Within / ST_DWithin / 网格聚合等 SQL 封装
│       └── geoserver.py      # GeoServer REST API 客户端
├── scripts/
│   ├── init_db.sql           # DDL：建表、索引、PostGIS 扩展（幂等）
│   ├── prepare_global.py     # 15GB TSV → 空间降采样 → 清洗 TSV（流式，可断点）
│   ├── import_to_pg.py       # 批量写入 occurrence_clean + species_lookup
│   └── build_grid.py         # 生成 occurrence_grid_monthly 聚合表
├── test_data/
│   ├── cn_sample_records.tsv
│   ├── sample_summary.json
│   └── 数据概况.md
├── tests/
│   ├── conftest.py
│   ├── test_occurrence.py
│   ├── test_species.py
│   └── test_stats.py
├── docker-compose.yml        # 给组员用的一键环境（可选，你本机直接忽略）
├── .env                      # 本机真实配置（不提交 git）
├── .env.example              # 配置模板（提交 git）
└── requirements.txt
```

与现有结构的主要变化：
- **新增** `models/`、`schemas/`、`services/`、`deps.py`——把"数据库模型 / API 形状 / 业务逻辑"三层拆分，避免 router 文件臃肿
- **重命名** `prepare_sample.py` → `prepare_global.py`（职责扩展为全球降采样）
- **重命名** `import_sample.py` → `import_to_pg.py`（通用导入脚本）
- **新增** `scripts/init_db.sql` 和 `scripts/build_grid.py`
- **新增** `tests/`
- **新增** `docker-compose.yml`（仅供组员本地启动 PG+GeoServer，你本机可以直接忽略）

---

## 三、环境配置

### 3.1 .env 关键变量

```ini
# PostgreSQL（本机已安装）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=birdscope
DB_USER=postgres
DB_PASSWORD=yourpassword

# GeoServer 2.28.1（本机已安装，端口 8080）
GEOSERVER_URL=http://localhost:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASSWORD=geoserver
GEOSERVER_WORKSPACE=birdscope
GEOSERVER_DATASTORE=birdscope_pg

# 原始数据路径（本机）
RAW_DATA_PATH=D:/EBIRD/0009321-260519110011954.csv

# FastAPI
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=true
```

### 3.2 数据库初始化（✅ 已完成）

```sql
CREATE DATABASE birdscope;
\c birdscope
CREATE EXTENSION IF NOT EXISTS postgis;
```

已运行 `scripts/init_db.sql` 建表，已导入 dev_sample.tsv（2000条）。

### 3.3 启动服务

**Python 环境**：使用 `D:\conda_env\conda_envs\devgis\python.exe`（系统默认 python 是 ArcGIS Pro 环境，没有所需依赖）。

```powershell
# 方式一：PowerShell
$env:PYTHONPATH=""
Set-Location "C:\Users\25316\Desktop\开发\大程\backend"
D:\conda_env\conda_envs\devgis\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

访问 `http://localhost:8000/docs` 查看 Swagger UI。

**注意**：本机设置了代理 `127.0.0.1:7897`，用浏览器访问 localhost 前，确保代理已关闭或设置了 localhost 直连。

### 3.4 GeoServer 手动前置步骤（一次性，在 Web 界面操作）

1. 登录 `http://localhost:8080/geoserver`
2. 新建工作空间：名称 `birdscope`，命名空间 URI `http://birdscope.local`
3. 新建数据存储：类型选 PostGIS，连接参数填 birdscope 数据库信息，名称 `birdscope_pg`

后续图层发布通过 API 自动完成。

### 3.4 依赖安装

```
fastapi>=0.111
uvicorn[standard]
sqlalchemy>=2.0
psycopg2-binary
python-dotenv
pydantic-settings
requests
shapely
pandas
```

geopandas 仅 `build_grid.py` 脚本用到，API 运行时不需要。

---

## 四、数据库设计

### 4.1 occurrence_clean（明细点表）

目标入库规模：**全球空间降采样后约 200–400 万条**（见第七节降采样策略）。

```sql
CREATE TABLE IF NOT EXISTS occurrence_clean (
  gbif_id          BIGINT PRIMARY KEY,
  species_key      BIGINT,
  taxon_key        BIGINT,
  bird_order       TEXT,
  family           TEXT,
  genus            TEXT,
  species          TEXT,          -- 可空；空时展示 scientific_name
  scientific_name  TEXT,
  country_code     CHAR(2),
  state_province   TEXT,
  locality         TEXT,
  individual_count INTEGER,       -- 可空（约 6% 缺失），不要填充为 1
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
```

### 4.2 occurrence_grid_monthly（全球聚合热力表）

由 `build_grid.py` 从 `occurrence_clean` 生成，支撑全球小比例尺热力图。

```sql
CREATE TABLE IF NOT EXISTS occurrence_grid_monthly (
  id             SERIAL PRIMARY KEY,
  year           SMALLINT,
  month          SMALLINT,
  grid_size      REAL,            -- 网格边长（度）：1.0 / 0.5 / 0.1
  record_count   INTEGER,
  individual_sum INTEGER,         -- NULL 值不计入
  center_lon     DOUBLE PRECISION,
  center_lat     DOUBLE PRECISION,
  geom           geometry(Polygon, 4326)
);

CREATE INDEX IF NOT EXISTS grid_time_idx ON occurrence_grid_monthly (year, month);
CREATE INDEX IF NOT EXISTS grid_size_idx ON occurrence_grid_monthly (grid_size);
CREATE INDEX IF NOT EXISTS grid_geom_idx ON occurrence_grid_monthly USING GIST (geom);
```

### 4.3 species_lookup（物种索引表）

```sql
CREATE TABLE IF NOT EXISTS species_lookup (
  species_key     BIGINT PRIMARY KEY,
  taxon_key       BIGINT,
  bird_order      TEXT,
  family          TEXT,
  genus           TEXT,
  species         TEXT,
  scientific_name TEXT,
  record_count    INTEGER
);

CREATE INDEX IF NOT EXISTS species_fts_idx ON species_lookup USING GIN (
  to_tsvector('simple',
    coalesce(species, '') || ' ' || coalesce(scientific_name, ''))
);
```

---

## 五、API 设计

基础前缀：`/api/v1`

### 5.1 物种接口 `/api/v1/species`

| 方法 | 路径 | 说明 | 关键参数 |
|------|------|------|----------|
| GET | `/search` | 物种名模糊搜索（搜索框用） | `q`（最短2字符）, `limit=10` |
| GET | `/{species_key}` | 物种详情 | — |
| GET | `/rank` | 物种排行（ECharts 条形图） | `country_code`, `month`, `year`, `limit=20` |

### 5.2 观测点接口 `/api/v1/occurrence`

| 方法 | 路径 | 说明 | 关键参数 |
|------|------|------|----------|
| GET | `/points` | 矩形范围内点查询（大比例尺用） | `bbox`="minx,miny,maxx,maxy", `species_key`, `month`, `year`, `limit=2000` |
| POST | `/within` | 多边形内点查询（地图框选用） | body: `{geometry, species_key, month, year, limit}` |
| GET | `/buffer` | 缓冲区查询 | `lat`, `lng`, `radius_km`, `species_key`, `month`, `limit=500` |

所有点查询返回 **GeoJSON FeatureCollection**，每个 Feature 的 properties：`gbif_id`, `species`, `scientific_name`, `individual_count`, `event_date`, `locality`, `country_code`, `state_province`。

### 5.3 统计接口 `/api/v1/stats`

| 方法 | 路径 | 说明 | 返回格式 |
|------|------|------|----------|
| GET | `/monthly` | 月度趋势（ECharts 折线图） | `[{month, record_count, individual_sum}]` |
| GET | `/province` | 省级统计 | `[{state_province, record_count}]` |
| GET | `/grid` | 网格聚合（中等尺度热力图） | GeoJSON FeatureCollection |
| GET | `/migration` | 物种迁徙重心（按月质心） | `[{month, center_lon, center_lat, record_count}]` |

`/stats/grid` 参数：`bbox`, `grid_size=1.0`（度）, `month`, `year`, `species_key`，最大返回 10000 格子。

`/stats/migration` 参数：`species_key`（必填），`year=2024`。

### 5.4 GeoServer 管理接口 `/api/v1/geoserver`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/layers` | 列出工作空间下所有图层 |
| POST | `/layers` | 发布新图层 |
| DELETE | `/layers/{name}` | 删除图层 |
| PUT | `/layers/{name}/style` | 切换样式 |

---

## 六、数据分级策略（与前端约定）

| Cesium 缩放级别 | 数据来源 | 实现方式 |
|-----------------|----------|----------|
| < 5（全球视角） | GeoServer WMS | `occurrence_grid_monthly` 1度网格，SLD 分级配色，CQL_FILTER 切月份 |
| 5–9（区域视角） | FastAPI `/stats/grid` | 0.5度网格，按 bbox 实时聚合，返回 GeoJSON |
| ≥ 10（本地视角） | FastAPI `/occurrence/points` | 真实点，bbox 裁剪，limit 2000 |

时间滑块切月份：
- 小比例尺：更新 WMS 的 `CQL_FILTER=month=8 AND year=2024`
- 大/中比例尺：重新调用 API 接口带 `month` 参数

---

## 七、数据处理流程（一周冲刺版）

### 全球降采样策略

原始 15GB TSV 约 2765 万条，不可能全部导入 PostGIS 做点查询。

**方案：空间降采样（Spatial Thinning）**

核心逻辑：对每个 `(0.1° × 0.1° 网格, species_key, month)` 组合只保留一条记录（取 gbif_id 最大者）。

- 全球约 (3600 × 1800 × 0.1度格子 =) 648,000 个空间格子
- 乘以鸟种数 ~10,000 和 4 个月份，理论上限约 259 亿——实际有记录的组合远少于此
- 估算实际入库：**200–400 万条**
- 全球分布均匀，中国、澳大利亚、英国等热点区域记录充分保留

**`prepare_global.py` 处理流程：**

```
输入：D:/EBIRD/0009321-260519110011954.csv（15GB TSV，流式读取）
  ↓
过滤：保留经纬度非空、basisOfRecord=HUMAN_OBSERVATION
  ↓
降采样：按 (round(lon,1), round(lat,1), species_key, month) 分组，每组取一条
  ↓
输出：backend/data/global_thinned.tsv（预计 200-400MB）
     backend/data/species_lookup.tsv（物种索引）
```

注意：流式处理，内存里只维护一个 `seen` 字典（键为上述4元组），不把整个文件读入内存。估计运行时间 20–40 分钟。

### ✅ 第一天（已完成）：环境 + 表结构 + 框架代码

- 数据库建表、PostGIS 扩展
- config / db / deps / models / schemas / services / routers / main.py 全部完成
- dev_sample.tsv（2000条全球样本）导入成功
- FastAPI 服务启动，9 个接口全部验证通过

### 第二天：写 `scripts/prepare_global.py` + 全量导入

1. 参考方案文档中的降采样策略，写 `prepare_global.py`
2. 运行：约 30 分钟，输出 `backend/data/global_thinned.tsv`
3. 运行 `import_to_pg.py --input backend/data/global_thinned.tsv`（约 20 分钟）
4. 运行 `build_grid.py` 生成热力聚合表

### 第三天：GeoServer 图层发布

1. GeoServer Web UI 建 workspace `birdscope` + datastore `birdscope_pg`
2. 调 `POST /api/v1/geoserver/layers` 发布 `occurrence_grid_monthly` 为 WMS 图层
3. 配置 SLD 分级配色样式
4. 前端测试 WMS 加载

### 第四天：前端联调

- 根据前端实际请求调整响应格式
- 压测 `/stats/grid` 和 `/occurrence/points`（目标 < 500ms）
- 处理任何 CORS 或格式问题

### 第五天：收尾

- 补 `scripts/build_grid.py`（生成 0.5度和 0.1度聚合层）
- 写 README 启动说明
- 备份数据库

---

## 八、性能预期与优化点

| 接口 | 预期响应时间 | 优化手段 |
|------|-------------|----------|
| `/species/search` | < 50ms | GIN 全文索引 |
| `/occurrence/points`（bbox） | < 200ms | GIST 索引 + limit 2000 |
| `/stats/grid`（有 species_key） | 200–500ms | 实时 ST_SnapToGrid，bbox 限制范围 |
| `/stats/grid`（无 species_key） | < 100ms | 直接查预聚合表 |
| `/stats/monthly` | < 100ms | (year, month) 联合索引 |
| WMS 全球热力图 | < 1s（GeoServer 缓存后） | GeoServer tile cache |

如果 `/stats/grid` 带 `species_key` 仍然慢，考虑加 `(species_key, year, month)` 联合索引。

---

## 九、常见坑预警

| 问题 | 原因 | 解决 |
|------|------|------|
| TSV 读出乱码 | 文件是 UTF-8，Windows 默认 GBK | `open(..., encoding='utf-8')` |
| `species` 字段为空 | 记录只匹配到属级 | 展示时 fallback 到 `scientific_name` |
| `individualCount` 为 NULL | 约 6% 记录缺失 | 热力图按记录数，数量图注明缺失 |
| PostGIS 坐标系报错 | 插入 geometry 未指定 SRID | `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` |
| GeoServer 发布失败 | datastore `birdscope_pg` 未建 | 先在 Web UI 手动建一次 datastore |
| CORS 报错 | FastAPI 未配 CORS | `main.py` 加 `CORSMiddleware(allow_origins=["*"])` |
| `prepare_global.py` 内存溢出 | seen 字典过大 | 改为按月份分批处理，每批结束后 flush |
| GeoServer 2.28 REST 路径变化 | 新版有些端点略有调整 | 参考官方文档 `/geoserver/rest` Swagger UI |

---

## 十、关于 Docker（给组员用）

```yaml
# docker-compose.yml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: birdscope
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init_db.sql:/docker-entrypoint-initdb.d/init.sql

  geoserver:
    image: kartoza/geoserver:2.28.0
    ports:
      - "8080:8080"
    environment:
      GEOSERVER_ADMIN_USER: admin
      GEOSERVER_ADMIN_PASSWORD: geoserver

volumes:
  pgdata:
```

组员使用方式：
```bash
docker-compose up -d
cp .env.example .env  # 填写密码
pip install -r requirements.txt
uvicorn app.main:app --reload
```

你本机有本地安装，跳过 docker-compose 直接修改 `.env` 里的连接信息即可。

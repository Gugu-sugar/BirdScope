# BirdScope 技术架构

> 来源整合：BirdScope_后端开发方案.md（第二、六节）、BirdScope_数据使用方案.md、AGENT.md 目录结构  
> 最后更新：2026-06-15

---

## 后端目录结构

```
backend/
├── app/
│   ├── main.py               # FastAPI 应用入口，注册路由、CORS、启动事件
│   ├── config.py             # 读取 .env，暴露 Settings 单例
│   ├── db.py                 # SQLAlchemy engine + SessionLocal + get_db 依赖
│   ├── deps.py               # 公用 FastAPI Depends（DB session、鉴权占位）
│   ├── models/               # SQLAlchemy ORM 模型（对应数据库表）
│   │   ├── occurrence.py     # OccurrenceClean
│   │   ├── grid.py           # OccurrenceGridMonthly
│   │   └── species.py        # SpeciesLookup
│   ├── schemas/              # Pydantic 请求/响应模型
│   │   ├── occurrence.py     # OccurrencePoint, OccurrenceGeoJSON…
│   │   ├── species.py        # SpeciesItem, SpeciesSearchResult…
│   │   └── stats.py          # MonthlyTrend, ProvinceStats, GridCell…
│   ├── routers/              # 路由层，只做参数校验和调用 service
│   │   ├── occurrence.py     # /api/v1/occurrence/*
│   │   ├── species.py        # /api/v1/species/*
│   │   ├── stats.py          # /api/v1/stats/*
│   │   └── geoserver.py      # /api/v1/geoserver/*
│   └── services/             # 业务逻辑层，PostGIS 查询和外部调用
│       ├── spatial.py        # 空间查询 SQL 封装
│       └── geoserver.py      # GeoServer REST API 客户端
├── scripts/
│   ├── init_db.sql           # DDL：建表、索引（幂等）
│   ├── prepare_global.py     # 15GB TSV → 空间降采样 → 清洗 TSV（流式）
│   ├── import_to_pg.py       # 批量写入 occurrence_clean + species_lookup
│   └── build_grid.py         # 生成 occurrence_grid_monthly 聚合表
├── test_data/
│   ├── dev_sample.tsv        # 2000行全球样本，当前主要测试数据
│   └── dev_sample_info.md    # 测试数据说明
├── tests/
│   └── test_app.py           # health/OpenAPI/GeoServer 鉴权冒烟测试
├── ../deploy/                # 数据库 dump 与可选 Docker 交付配置
├── .env                      # 本机配置（不提交 git）
├── .env.example              # 配置模板（提交 git）
└── requirements.txt
```

---

## 三层业务架构

```
HTTP 请求
    │
    ▼
routers/    ← 参数校验、HTTP 语义（FastAPI APIRouter）
    │
    ▼
services/   ← 业务逻辑、空间 SQL（PostGIS）、外部 HTTP 调用（GeoServer）
    │
    ▼
models/     ← SQLAlchemy ORM 映射（表定义）
schemas/    ← Pydantic 请求/响应形状（数据校验与序列化）
```

Router 只做参数校验，不写业务逻辑；Service 不依赖 HTTP，便于单元测试。

---

## 数据分层策略

平台数据分为四层，不直接对前端暴露原始 15GB TSV：

| 层 | 说明 | 对应存储 |
|----|------|----------|
| 原始层 raw | 15GB TSV，只作可追溯源，不查询 | D:/EBIRD/*.csv |
| 清洗层 | 空间降采样后的全球明细点（约 200–400 万条）| `occurrence_clean` |
| 聚合层 | 预计算月度网格（全球热力）| `occurrence_grid_monthly` |
| 索引层 | 物种搜索索引 | `species_lookup` |

---

## 分级渲染策略（与前端约定）

| Cesium 缩放级别 | 看到什么 | 数据来源 | 实现方式 |
|-----------------|----------|----------|----------|
| < 5（全球视角） | 热力图 | GeoServer WMS | `occurrence_grid_monthly` 1 度网格，SLD 分级配色，CQL_FILTER 切月份 |
| 5–9（区域视角） | 格子热力 | FastAPI `/stats/grid` | 0.5 度网格，bbox 实时聚合，返回 GeoJSON |
| ≥ 10（本地视角）| 真实点 | FastAPI `/occurrence/points` | 真实观测点，bbox 裁剪，limit 2000 |

**时间滑块切月份：**
- 小比例尺：更新 GeoServer WMS 的 `CQL_FILTER=month=X AND year=2024`
- 中/大比例尺：重新调用 API 接口加 `?month=X` 参数

---

## GeoServer / FastAPI / 前端职责边界

### GeoServer
适合发布稳定、重绘频繁的地图层：
- `occurrence_grid_monthly` → WMS 热力图（全球视角）
- 通过 FastAPI `/api/v1/geoserver/*` 接口在线管理图层生命周期

### FastAPI
适合做业务查询和统计：
- 物种全文搜索
- 时间 + 空间组合查询（bbox / 多边形 / 缓冲区）
- 统计聚合（月度趋势、省级分布、迁徙重心）
- GeoServer REST 管控（图层发布、样式切换）

### React + CesiumJS
- 小比例尺加载 GeoServer WMS
- 大比例尺调用 FastAPI GeoJSON
- 时间滑块切换月份
- ECharts 接收 FastAPI 统计 JSON

---

## 坐标系约定

- 所有坐标均使用 **WGS-84（EPSG:4326）**
- bbox 格式：`minx,miny,maxx,maxy`（经度在前，纬度在后）
- GeoJSON coordinates 格式：`[经度, 纬度]`，即 `[116.4, 39.9]`
- 中国大致范围：`73,18,135,54`

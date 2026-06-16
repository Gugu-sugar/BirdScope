# BirdScope — Agent Reference

AI Agent 工作前必读此文件。本文件是项目级快速参考和流程规范；详细文档分为：

- 后端文档：`backend-docs/`
- 前端文档：`frontend-docs/`

最后更新：2026-06-15

---

## 文档导航

### 后端文档

| 文档 | 内容 | 何时读 |
|------|------|--------|
| [backend-docs/project_overview.md](backend-docs/project_overview.md) | 项目背景、目标、功能模块、团队分工 | 初次接入项目时 |
| [backend-docs/architecture.md](backend-docs/architecture.md) | 后端目录结构、三层架构、数据分层、分级渲染策略 | 修改后端结构前 |
| [backend-docs/dev_plan.md](backend-docs/dev_plan.md) | 后端环境配置、启动命令、时间线、常见坑 | 搭建后端环境 / 开发后端任务前 |
| [backend-docs/progress.md](backend-docs/progress.md) | 后端进度、已完成功能、下一步目标 | 接手后端任务时 |
| [backend-docs/database_design.md](backend-docs/database_design.md) | 表结构、索引、设计说明 | 涉及数据库操作前 |
| [backend-docs/data_pipeline.md](backend-docs/data_pipeline.md) | 数据清洗、降采样、导入、聚合流程 | 运行数据管道脚本前 |
| [backend-docs/api_reference.md](backend-docs/api_reference.md) | API 参数、示例、响应格式 | 实现或修改接口前 |
| [backend-docs/rules_and_conventions.md](backend-docs/rules_and_conventions.md) | 数据规则、编码规范、禁止事项 | 每次写后端代码前 |
| [backend-docs/human_review.md](backend-docs/human_review.md) | 人工审批记录 | 涉及破坏性操作前必须检查 |
| [backend-docs/assessments/](backend-docs/assessments/) | 阶段性评估报告 | 做优化决策时 |

### 前端文档

| 文档 | 内容 | 何时读 |
|------|------|--------|
| [frontend-docs/README.md](frontend-docs/README.md) | 前端文档入口和当前结论 | 初次接手前端任务 |
| [frontend-docs/project_overview.md](frontend-docs/project_overview.md) | 前端目标、页面工作流、当前范围 | 理解前端功能边界 |
| [frontend-docs/architecture.md](frontend-docs/architecture.md) | 目录结构、组件分层、状态流、地图接入点 | 修改前端结构前 |
| [frontend-docs/dev_plan.md](frontend-docs/dev_plan.md) | 启动、构建、联调、冒烟流程 | 本地开发或排查启动问题 |
| [frontend-docs/api_integration.md](frontend-docs/api_integration.md) | API 封装、请求参数、响应类型、坐标约定 | 改 API 调用或联调后端 |
| [frontend-docs/rules_and_conventions.md](frontend-docs/rules_and_conventions.md) | UI、数据展示、空间和编码规范 | 每次写前端代码前 |
| [frontend-docs/progress.md](frontend-docs/progress.md) | 当前实现、缺口、下一步优先级 | 接手前端任务或阶段复盘 |

---

## 项目架构总览

```text
GBIF/eBird TSV 数据
    ↓
backend/scripts/ 数据清洗、降采样、导入、网格预聚合
    ↓
PostgreSQL + PostGIS
    ├── FastAPI /api/v1 业务查询、统计、GeoServer 管控
    └── GeoServer WMS/WFS 热力图层
            ↓
frontend/ React 查询工作台、地图、结果列表、后续图表
```

### 根目录结构

```text
.
├── backend/          # FastAPI + SQLAlchemy + PostGIS 业务服务
├── frontend/         # Vite + React + TypeScript + Tailwind 前端
├── backend-docs/     # 后端文档，原 docs/ 已改名
├── frontend-docs/    # 前端文档
├── deploy/           # 数据库 dump、恢复说明与可选 Docker 配置
├── AGENT.md          # Agent 项目级快速参考
└── README.md         # 项目启动说明
```

---

## 后端快速参考

**本机 Python 环境**：`E:/Anaconda3/envs/devgis/python.exe`
**后端工作目录**：所有 `from app.xxx` 导入假设 cwd 为 `backend/`

**本地数据库**：PostgreSQL 18 + PostGIS 3.6，数据库快照位于 `deploy/dump/birdscope.dump`。默认采用本地原生运行，不依赖 Docker。

启动 FastAPI：

```powershell
cd backend
E:/Anaconda3/envs/devgis/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

后端核心分层：

```text
backend/app/
├── main.py        # FastAPI 应用入口，注册路由、CORS、启动事件
├── config.py      # Settings 单例
├── db.py          # SQLAlchemy engine/session
├── deps.py        # 公共 Depends
├── models/        # SQLAlchemy ORM
├── schemas/       # Pydantic 请求/响应模型
├── routers/       # HTTP 语义和参数校验
└── services/      # 业务逻辑、PostGIS SQL、GeoServer 调用
```

Router 只做 HTTP 参数校验和调用 service；业务逻辑放 `services/`。

---

## 前端快速参考

**技术栈**：Vite + React + TypeScript + Tailwind CSS + Cesium + ECharts + lucide-react
**默认开发地址**：`http://localhost:5173`  
**默认 API 地址**：`http://localhost:8000/api/v1`

启动前端：

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

构建前端：

```powershell
cd frontend
npm.cmd run build
```

如后端地址不同，在 `frontend/.env.local` 中配置：

```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

前端核心分层：

```text
frontend/src/
├── main.tsx
├── App.tsx
├── pages/MapQueryPage.tsx
├── components/
│   ├── map/MapPanel.tsx
│   ├── query/QueryPanel.tsx, ResultList.tsx
│   └── charts/TimeSlider.tsx, *Chart.tsx
├── store/queryStore.tsx
├── api/client.ts, occurrence.ts, species.ts, stats.ts
└── types/api.ts, geo.ts
```

当前页面数据流：

```text
QueryPanel / MapPanel
    ↓
QueryProvider
    ↓
api/*
    ↓
FastAPI /api/v1
    ↓
Cesium 点位 / ResultList（待重新挂回页面）/ ECharts
```

`MapPanel` 已接入 Cesium、三种空间绘制和 WMS/点位切换，并继续通过 `onBboxSelected`、`onPolygonSelected`、`onBufferCenterSelected` 回传空间结果。

当前前端联调仍有已知问题：物种搜索响应类型需与后端数组响应统一；WMS 应使用 `CQL_FILTER` 同时限定 `grid_size` 与 `month`；`ResultList` 已实现但当前页面未渲染。运行成功不等于这些功能已验收。

---

## API 与地图约定

基础前缀：`/api/v1`

前端当前已封装：

| 前端函数 | 后端接口 | 用途 |
|----------|----------|------|
| `searchSpecies` | `GET /species/search` | 物种搜索 |
| `queryOccurrenceByBbox` | `GET /occurrence/points` | bbox 点查询 |
| `queryOccurrenceWithin` | `POST /occurrence/within` | 多边形点查询 |
| `queryOccurrenceBuffer` | `GET /occurrence/buffer` | 缓冲区点查询 |
| `queryGrid` | `GET /stats/grid` | 网格热力 API，UI 分级渲染仍待完善 |

分级渲染建议：

| 视图层级 | 数据来源 | 说明 |
|----------|----------|------|
| 全球视角 | GeoServer WMS | `birdscope:occurrence_grid_monthly` |
| 区域视角 | `GET /api/v1/stats/grid` | 0.5° 或 1.0° 网格 |
| 本地视角 | `GET /api/v1/occurrence/points` | 真实观测点，默认 limit 2000 |

WMS 注意：请求 `occurrence_grid_monthly` 时必须至少限定 `grid_size` 和 `month`，否则 1.0° / 0.5° 与各月份会叠加渲染。

---

## 数据规则

1. `species` 可为 NULL，展示时 fallback 到 `scientific_name`，不可因此崩溃。
2. `individual_count` 可为 NULL，展示为“数量未知”；禁止静默填充为 0 或 1。
3. 所有坐标使用 WGS-84 / EPSG:4326。
4. bbox 格式为 `minx,miny,maxx,maxy`；GeoJSON coordinates 为 `[longitude, latitude]`。
5. geometry 入库必须指定 SRID：`ST_SetSRID(ST_MakePoint(lon, lat), 4326)`。
6. 点查询硬上限 5000（默认 2000）；网格硬上限 10000。
7. `/stats/migration` 是各月观测重心，不是单只鸟 GPS 轨迹，不可描述为“个体迁徙路径”。
8. 热力图和统计图表达记录数 / 采样密度，不应直接等同真实种群丰度。

---

## 工作流程

### 本地完整启动顺序

1. 启动本机 PostgreSQL 18/PostGIS 3.6，并恢复 `deploy/dump/birdscope.dump`。
2. 配置 `backend/.env`，启动 FastAPI `localhost:8000`。
3. 启动 GeoServer `localhost:8080`，运行 `backend/scripts/setup_geoserver.py`。
4. 在 `frontend/` 执行 `npm.cmd ci`、`npm.cmd run dev`。
5. 依次验证 `/health`、`/docs`、WMS 和 `http://localhost:5173`。

### 开发流程

1. 读 `AGENT.md`。
2. 根据任务选择 `backend-docs/` 或 `frontend-docs/` 的对应文档。
3. 涉及破坏性操作、数据库 schema、API 响应格式、GeoServer 图层发布/删除、全量数据导入时，先检查 [backend-docs/human_review.md](backend-docs/human_review.md)。
4. 修改代码并遵守对应规范文档。
5. 做最小必要验证：后端跑接口/测试，前端跑构建或本地冒烟。
6. 功能完成后同步更新对应 `progress.md`。
7. 若接口契约变更，同时更新 [backend-docs/api_reference.md](backend-docs/api_reference.md) 和 [frontend-docs/api_integration.md](frontend-docs/api_integration.md)。

### 文档更新流程

- 后端代码、数据、API、GeoServer 变更：更新 `backend-docs/`。
- 前端页面、组件、状态、API 调用、地图接入变更：更新 `frontend-docs/`。
- 项目级结构、关键规则、目录变更：更新 `AGENT.md`。
- `backend-docs/assessments/` 是历史评估记录；不要改旧报告，只追加新报告。


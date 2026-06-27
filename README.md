# BirdScope

> 基于 GBIF/eBird 全球鸟类观测数据的三维地图查询与可视化平台。

BirdScope 面向观鸟爱好者与生态研究者，把约 **400 万条**经过空间降采样的鸟类观测记录，以**分级渲染**的方式呈现在三维地球上，并提供物种、时间、空间的多维组合查询、统计图表与时空动态。数据覆盖六大洲、2024 年 8–11 月迁徙季。

---

## 核心功能

- **三维地图分级渲染**：全球热力图（GeoServer WMS）/ 区域网格聚合（粒度按范围自适应）/ 本地真实观测点，随查询范围切换数据源。
- **多维组合查询**：物种搜索 + 月份多选 + 空间筛选（矩形框选 / 多边形 / 缓冲区），结果与地图点位、列表、图表四向联动。
- **时空动态**：时间轴按月（8–11 月）播放，热力图层与统计图表随之更新。
- **统计图表**：物种排行、月度趋势、区域统计（ECharts），随查询范围实时联动。
- **图层管理与发布**：底图切换、图层显隐叠加；可把当前视图发布为 GeoServer 图层（预聚合·全物种 / 实时聚合·当前物种双模式）。

---

## 技术栈

| 层       | 技术                                                               |
| -------- | ------------------------------------------------------------------ |
| 数据管道 | Python 3.11、DuckDB、pandas（清洗 / 两步空间降采样 / 预聚合）      |
| 存储     | PostgreSQL 18 + PostGIS 3.6                                        |
| 地图服务 | GeoServer 2.28.1（WMS/WFS 热力图层）                               |
| 后端     | FastAPI、SQLAlchemy 2.x、GeoAlchemy2、psycopg2                     |
| 前端     | Vite 7 + React 19 + TypeScript + Tailwind CSS + CesiumJS + ECharts |

---

## 系统架构

```text
GBIF/eBird TSV 原始数据（约 15GB + 21.8GB）
    │  backend/scripts/ 清洗 · 两步降采样 · 导入 · 预聚合
    ▼
PostgreSQL 18 + PostGIS 3.6
    ├── occurrence_clean        明细点（约 399.8 万条）
    ├── occurrence_grid_monthly 预聚合热力网格
    ├── occurrence_stats_monthly 图表月度事实表
    └── species_lookup          物种索引
    │
    ├──▶ GeoServer ─ WMS/WFS 热力图层 ─┐
    └──▶ FastAPI /api/v1 ─ 查询·统计·GeoServer 管控 ─┤
                                                      ▼
              frontend/ React + Cesium + ECharts 查询工作台
```

数据分四层（原始 / 清洗 / 聚合 / 索引），不直接对前端暴露原始 TSV。详见 [backend-docs/architecture.md](backend-docs/architecture.md)。

---

## 快速开始

环境、依赖与完整部署步骤见 **[DEPLOYMENT.md](DEPLOYMENT.md)**。最简流程：

1. 安装 PostgreSQL 18 + PostGIS 3.6，恢复 `deploy/dump/birdscope.dump`。
2. 配置 `backend/.env`，启动 FastAPI（`localhost:8000`）。
3. 启动 GeoServer（`localhost:8080`），运行 `backend/scripts/setup_geoserver.py`。
4. 前端 `npm.cmd ci && npm.cmd run dev`，访问 `http://localhost:5173`。

数据库与 GeoServer 就绪后，也可用一键脚本启动后端 + 前端：

```powershell
.\start.ps1            # 检查状态并启动
.\start.ps1 -CheckOnly # 只做状态检查
```

---

## 文档导航

| 主题                               | 文档                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| 环境 / 依赖 / 部署                 | [DEPLOYMENT.md](DEPLOYMENT.md)                               |
| 项目约定与快速参考                 | [AGENT.md](AGENT.md)                                         |
| 后端架构 / API / 数据库 / 数据管道 | [backend-docs/](backend-docs/)                               |
| 后端完成情况与验收清单             | [backend-docs/progress.md](backend-docs/progress.md)         |
| 前端架构 / API 联调 / 规范         | [frontend-docs/](frontend-docs/)                             |
| 前端完成情况与验收清单             | [frontend-docs/progress.md](frontend-docs/progress.md)       |
| 数据快照与恢复                     | [deploy/README.md](deploy/README.md)                         |
| 人工审批记录                       | [backend-docs/human_review.md](backend-docs/human_review.md) |
| 团队分工                           | [分工.md](分工.md)                                           |

---

## 数据说明

数据仅覆盖 2024 年 8–11 月；热力图与统计图表表达的是**观测记录 / 采样密度**，不等同真实种群丰度。详见 [backend-docs/rules_and_conventions.md](backend-docs/rules_and_conventions.md)。

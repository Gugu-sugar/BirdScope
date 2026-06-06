# BirdScope Backend — Agent Reference

AI Agent 工作前必读此文件。本文件是**快速参考和流程规范**，详细内容在 `docs/` 目录。

---

## 文档导航

在开始任何任务前，根据任务类型阅读对应文档：

| 文档 | 内容 | 何时读 |
|------|------|--------|
| [docs/project_overview.md](docs/project_overview.md) | 项目背景、目标、功能模块、团队分工 | 初次接入项目时 |
| [docs/architecture.md](docs/architecture.md) | 目录结构、三层架构、数据分层、分级渲染策略 | 修改代码结构前 |
| [docs/dev_plan.md](docs/dev_plan.md) | 环境配置、启动命令、时间线、常见坑 | 搭建环境 / 开发阶段任务前 |
| [docs/progress.md](docs/progress.md) | 当前进度、已完成功能、下一步目标 | 接手任务时了解现状 |
| [docs/database_design.md](docs/database_design.md) | 三张表的完整 DDL、索引、设计说明 | 涉及数据库操作前 |
| [docs/data_pipeline.md](docs/data_pipeline.md) | 数据清洗、降采样、导入、聚合流程 | 运行数据管道脚本前 |
| [docs/api_reference.md](docs/api_reference.md) | 所有 API 接口参数、示例、响应格式 | 实现或修改接口前 |
| [docs/rules_and_conventions.md](docs/rules_and_conventions.md) | 数据规则、编码规范、禁止事项 | 每次写代码前 |
| [docs/human_review.md](docs/human_review.md) | 人工审批记录，开发者在此写批准意见 | **涉及破坏性操作前必须检查** |
| [docs/assessments/](docs/assessments/) | 不同视角的评估报告 | 做阶段性优化决策时 |

---

## 快速参考：环境与启动

**Python 环境**：`D:/conda_env/conda_envs/devgis/python.exe`（系统 python 是 ArcGIS Pro 环境，不可用）

**工作目录**：所有 `from app.xxx` 导入假设 cwd 为 `backend/`

**启动服务器**：
```python
# 在 Agent 中执行（处理 Windows 中文路径问题）
import os, subprocess
os.chdir(r'C:\Users\25316\Desktop\开发\大程\backend')
subprocess.Popen([
    r'D:/conda_env/conda_envs/devgis/python.exe', '-m', 'uvicorn',
    'app.main:app', '--host', '0.0.0.0', '--port', '8000'
])
```

或在已切换到 `backend/` 的终端：
```
D:/conda_env/conda_envs/devgis/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**代理注意**：本机设置了 http_proxy（端口 7897）。curl 测试加 `--noproxy localhost`；Python 测试前 `del os.environ['http_proxy']`。

**Settings**：永远用 `from app.config import settings`，不用 `os.environ` 直接读。

---

## 快速参考：空间查询模式

```python
# services/spatial.py

# 1. bbox 过滤（GIST 索引，快速但近似）
def bbox_filter(bbox_str: str):
    minx, miny, maxx, maxy = map(float, bbox_str.split(","))
    return text("geom && ST_MakeEnvelope(:minx,:miny,:maxx,:maxy,4326)").bindparams(...)

# 2. 多边形精确 within
def within_filter(geojson_str: str):
    return text("ST_Within(geom, ST_SetSRID(ST_GeomFromGeoJSON(:geojson),4326))").bindparams(...)

# 3. 球面缓冲区（geography 类型，真实公里数）
def buffer_filter(lat, lng, radius_km):
    return text("ST_DWithin(geom::geography, ST_MakePoint(:lng,:lat)::geography, :r)").bindparams(
        lng=lng, lat=lat, r=radius_km*1000)

# 4. 实时网格聚合（species_key 存在时）
"""
SELECT
  floor(ST_X(geom)/:gs)*:gs + :gs/2 AS center_lon,
  floor(ST_Y(geom)/:gs)*:gs + :gs/2 AS center_lat,
  count(*) AS record_count, sum(individual_count) AS individual_sum,
  ST_AsGeoJSON(ST_MakeEnvelope(..., 4326)) AS geom_json
FROM occurrence_clean
WHERE geom && ST_MakeEnvelope(:minx,:miny,:maxx,:maxy,4326)
  AND (:month IS NULL OR month = :month)
  AND (:species_key IS NULL OR species_key = :species_key)
GROUP BY center_lon, center_lat
LIMIT :max_cells
"""
```

---

## 数据规则（必须遵守，不可违背）

1. `species` 可为 NULL → 展示时 fallback 到 `scientific_name`，不可因此崩溃
2. `individual_count` 可为 NULL（约 6%）→ 热力图按记录数；**禁止填充为 1**
3. geometry 插入必须指定 SRID：`ST_SetSRID(ST_MakePoint(lon, lat), 4326)`
4. 坐标质量问题记录（`COUNTRY_COORDINATE_MISMATCH` 等）→ 不可静默删除，须记录过滤决策
5. 点查询硬上限：**5000**（默认 2000）；网格硬上限：**10000**
6. `/stats/migration` 是观测重心，**不是 GPS 轨迹**，不可描述为"单只鸟迁徙路径"

---

## 常见错误速查

| 错误 | 正确做法 |
|------|----------|
| `open(path)` 不指定编码 | `open(path, encoding='utf-8')` |
| `species` 为 null 时报错 | fallback 到 `scientific_name` |
| NULL `individual_count` 填为 1 | 保持 NULL，查询层处理 |
| `ST_MakePoint(lon, lat)` 无 SRID | `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` |
| 返回无 LIMIT 的全量点 | 始终加 LIMIT，硬上限 5000 |
| 在 GeoServer 配置前调用图层接口 | 先在 Web UI 建 workspace + datastore |
| 在 router 里写业务逻辑 | 业务逻辑放 services/ |
| 直接用 `os.environ` | `from app.config import settings` |

---

## Pydantic Schema 速查

```python
class SpeciesItem(BaseModel):
    species_key: int
    species: str | None          # 可为 null
    scientific_name: str
    bird_order: str | None
    family: str | None
    record_count: int

class OccurrenceFeatureProperties(BaseModel):
    gbif_id: int
    species: str | None
    scientific_name: str
    individual_count: int | None  # 可为 null
    event_date: date
    locality: str | None
    country_code: str
    state_province: str | None

class MonthlyTrendItem(BaseModel):
    month: int
    record_count: int
    individual_sum: int | None    # NULL 记录不计入

class GridFeatureProperties(BaseModel):
    record_count: int
    individual_sum: int | None
    center_lon: float
    center_lat: float
```

---

## 测试数据

**当前主要测试数据**：`backend/test_data/dev_sample.tsv`
- 2000 行，10 国，20 列，与 `occurrence_clean` 完全对应
- 含 NULL 边界情况（29 行 null species，108 行 null individual_count）
- 说明文档：`backend/test_data/dev_sample_info.md`

---

## 完整工作流程

### 一、开发流程（每次编码任务）

```
1. 读 AGENT.md（本文件）
2. 根据任务类型读对应 docs/ 文档
3. 检查 docs/human_review.md：是否有未批准的相关待审批项
4. 编写代码，遵守 docs/rules_and_conventions.md
5. 用 dev_sample.tsv 测试（启动服务 → 访问 /docs → 测试接口）
6. 完成后更新 docs/progress.md（已完成项打 ✅）
7. 若修改了接口，同步更新 docs/api_reference.md
```

### 二、阶段评估流程（完成里程碑后）

```
1. 确定评估视角（GIS 专家 / 安全 / 性能 / 前端对接 等）
2. 针对该视角分析已实现内容
3. 创建评估报告：docs/assessments/YYYY-MM-DD_<视角>.md
4. 在报告中按"亮点 / 问题 / 改进建议（按优先级）"结构输出
5. 将高优先级问题同步到 docs/progress.md 的"已知技术债"区
```

### 三、更新文档流程（每次功能完成后）

```
1. docs/progress.md — 更新进度表和下一步目标
2. docs/api_reference.md — 若接口有变更，更新参数/响应示例
3. docs/database_design.md — 若 schema 有变更，更新 DDL
4. AGENT.md — 若有新的关键规则或 schema 变化，同步更新快速参考区
5. 不要修改 docs/assessments/ 中已有报告（历史记录，只追加）
```

### 四、人工 Review 流程（涉及破坏性操作时）

**触发条件**（遇到以下情况时，Agent 必须停止操作，在 human_review.md 中提交待审批项，等待开发者审批后再继续）：

- 删除文件、目录或数据
- 修改数据库 schema（增删字段、变更索引）
- 变更 API 响应格式（可能破坏前端兼容性）
- 发布或删除 GeoServer 图层
- 运行全量数据导入脚本（`prepare_global.py` / `import_to_pg.py`）

**流程**：
```
1. Agent 停止执行，在 docs/human_review.md "待审批"区追加新条目
   - 填写：编号、标题、时间、类型、变更描述、影响范围
2. 通知开发者查看 docs/human_review.md
3. 开发者在"审批意见"栏填写：批准 / 拒绝 / 修改后批准
4. Agent 在下次对话开始时检查 human_review.md：
   - 批准 → 执行操作
   - 拒绝 → 放弃该操作，按开发者意见调整方案
   - 修改后批准 → 按说明调整后执行
5. 已处理的条目移入 human_review.md "历史记录"区
```

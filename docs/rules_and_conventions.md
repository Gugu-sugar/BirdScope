# BirdScope 数据规则与开发规范

> 来源整合：AGENT.md 数据规则章节、Common Mistakes  
> 最后更新：2026-06-06

---

## 数据完整性规则（所有开发者和 AI Agent 必须遵守）

### 1. species 可以为 NULL

~1.4% 的记录（对应 GBIF issue `TAXON_MATCH_HIGHERRANK`）仅匹配到属级，`species` 字段为 NULL。

- 展示时：始终以 `scientific_name` 作为 fallback，**不可因 `species` 为 null 而崩溃或报错**
- 统计物种级数据时：须标记"未精确到种"，不混入物种级统计

### 2. individual_count 可以为 NULL

约 6% 的观测记录没有个体数量。

- 热力图、记录数统计：按**记录数**（行数）计，不使用 `individual_count`
- 数量分析图表：过滤 NULL 后统计，并在说明中注明缺失比例
- **禁止：将 NULL `individual_count` 静默填充为 1 或 0**

### 3. geometry 插入必须指定 SRID

```python
# 正确
ST_SetSRID(ST_MakePoint(lon, lat), 4326)
# 错误
ST_MakePoint(lon, lat)   # 无 SRID，PostGIS 不知道坐标系
```

### 4. 坐标质量问题不可静默删除

`issue` 字段含 `COUNTRY_COORDINATE_MISMATCH` 或 `PRESUMED_SWAPPED_COORDINATE` 的记录坐标可疑，但不得在未记录决策的情况下删除。过滤时必须文档化过滤规则。

### 5. 点查询硬上限

- 单次 API 返回点数：**不超过 5000**（default limit 2000）
- 单次网格聚合：**不超过 10000 格**
- 禁止返回无 LIMIT 的全表扫描结果

### 6. 迁徙路径诠释

`/stats/migration` 返回的是每月观测**重心**（`ST_Centroid(ST_Collect(geom))` 按月分组），**不是 GPS 追踪轨迹**。不可描述为"单只鸟的迁徙路径"，原始数据不含个体 ID，不支持个体追踪。

---

## 编码规范

### 配置读取

```python
# 正确
from app.config import settings
db_host = settings.DB_HOST

# 错误
import os
db_host = os.environ['DB_HOST']
```

### 文件读取

```python
# 正确
open(path, encoding='utf-8')

# 错误
open(path)   # Windows 默认 GBK，UTF-8 文件会乱码
```

### TSV 读取

```python
import csv
with open(path, encoding='utf-8', newline='') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for row in reader:
        ...
```

### 大文件处理

15GB TSV **必须流式处理**，禁止全量读入内存。使用 `csv.DictReader` 逐行处理，不使用 `pandas.read_csv` 全量加载。

---

## 常见错误速查

| 错误 | 正确做法 |
|------|----------|
| `open(path)` 不指定编码 | `open(path, encoding='utf-8')` |
| 把 `species` 为 null 当错误处理 | fallback 到 `scientific_name` |
| 把 NULL `individual_count` 填充为 1 | 保持 NULL，在查询层处理 |
| `ST_MakePoint(lon, lat)` 无 SRID | `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` |
| 返回全量点（无 LIMIT）| 始终加 LIMIT，硬上限 5000 |
| 在 GeoServer 配置前调用图层接口 | 先在 Web UI 建 workspace + datastore |
| 在 router 层写业务逻辑 | 业务逻辑放 services/，router 只做参数校验 |
| 在 services 层直接用 `os.environ` | `from app.config import settings` |
| bbox 解析放在 router 里 | bbox 解析在 `services/spatial.py`，schema 层验证格式 |
| 把迁徙重心描述为 GPS 轨迹 | 明确说明是"各月观测重心"，不是追踪数据 |

---

## 代理环境注意事项

本机代理设置为 `127.0.0.1:7897`（端口 7897），影响：

- `curl` 测试时加 `--noproxy localhost`
- Python HTTP 测试时先 `del os.environ['http_proxy']`
- 浏览器访问 localhost 前确认代理已设置直连

---

## bbox 过滤说明

当前使用 `geom && ST_MakeEnvelope(...)` 做矩形包围盒过滤（GIST 索引加速）。这是 Cesium 视口的常见近似，不是精确几何相交（精确相交用 `ST_Intersects`，但性能较低）。limit=2000 的截断机制部分缓解了误差问题。

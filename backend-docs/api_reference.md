# BirdScope API 接口文档

> 来源整合：AGENT.md API 章节、BirdScope_后端进展说明.md  
> 基础前缀：`/api/v1` | 所有坐标 WGS-84（EPSG:4326）| 所有响应 JSON  
> 最后更新：2026-06-15

---

## 快速测试入口

服务运行后打开：`http://localhost:8000/docs`（Swagger UI，可直接点按钮测试）

---

## 物种接口 `/api/v1/species`

### GET /search — 物种搜索（搜索框自动补全）

**参数**：
- `q: str` — 搜索词，最短 2 字符
- `limit: int = 10`

**示例**：`GET /api/v1/species/search?q=Pycnonotus`

**响应** `List[SpeciesItem]`：
```json
[
  { "species_key": 5228134, "species": "Pycnonotus sinensis",
    "scientific_name": "Pycnonotus sinensis (Gmelin, 1789)",
    "family": "Pycnonotidae", "bird_order": "Passeriformes", "record_count": 17 },
  { "species_key": 2479598, "species": null,
    "scientific_name": "Eolophus roseicapilla (Vieillot, 1817)",
    "family": "Cacatuidae", "bird_order": "Psittaciformes", "record_count": 15 }
]
```

注意：`species` 可能为 null，展示时用 `scientific_name`。

---

### GET /{species_key} — 物种详情

**示例**：`GET /api/v1/species/5228134`

**响应** `SpeciesItem`（同上格式，单条）

---

### GET /rank — 物种排行（ECharts 条形图用）

**参数**：
- `country_code: str | None` — 国家过滤，如 `CN`
- `month: int | None` — 1–12
- `year: int = 2024`
- `limit: int = 20`
- `bbox: str | None` — `"minx,miny,maxx,maxy"`。带 bbox 时按该范围**实时聚合** `occurrence_clean`（地图联动用）；不带时走预聚合事实表。bbox 面积超护栏（默认 3000 平方度）自动回退预聚合，避免大范围全表扫描。

**示例**：`GET /api/v1/species/rank?bbox=116,39,118,41&month=10`（北京范围联动）

**响应** `List[SpeciesRankItem]`：
```json
[
  { "species_key": 5228134, "species": "Pycnonotus sinensis",
    "record_count": 17, "individual_sum": 102 },
  { "species_key": 2493163, "species": "Motacilla alba",
    "record_count": 14, "individual_sum": 38 }
]
```

---

## 观测点接口 `/api/v1/occurrence`

### GET /points — 矩形范围内点查询（大比例尺地图用）

**参数**：
- `bbox: str` — `"minx,miny,maxx,maxy"`，如 `"70,20,140,55"`
- `species_key: int | None`
- `month: int | None` — 单月份（向后兼容）
- `months: list[int] | None` — 多选月份，重复传参 `months=8&months=9`；非空时优先于 `month`，缺省/空表示全年
- `year: int = 2024`
- `limit: int = 2000`（硬上限 5000，禁止超越）

> 返回点在选区内随机均匀抽样，避免命中前 N 行集中在数据先入库的一角。按选区外接框面积**自适应**：≤50 平方度（本地视角）走精确 `ORDER BY random()`（候选少、快）；超过则改 `TABLESAMPLE SYSTEM(3)` 物理页抽样后随机取 N（大范围从秒级降到约 0.5s，分布仍铺满选区，代价是不再精确逐行）。`/within` 同此策略（按几何外接框面积判定）；`/buffer` 半径上限 500km 始终本地，保持精确。

**示例**：`GET /api/v1/occurrence/points?bbox=70,20,140,55&months=9&months=10`

**响应** GeoJSON FeatureCollection（Cesium 可直接加载）：
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [121.47, 31.23] },
      "properties": {
        "gbif_id": 5386589584,
        "species": "Spilopelia chinensis",
        "scientific_name": "Spilopelia chinensis (Scopoli, 1786)",
        "individual_count": 2,
        "event_date": "2024-10-03",
        "locality": "上海世纪公园",
        "country_code": "CN",
        "state_province": "Shanghai"
      }
    }
  ],
  "total": 1
}
```

---

### POST /within — 多边形内点查询（地图框选用）

**请求体**：
```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[116.0, 39.0], [117.0, 39.0], [117.0, 40.0], [116.0, 40.0], [116.0, 39.0]]]
  },
  "species_key": 5228134,
  "months": [9, 10],
  "year": 2024,
  "limit": 800
}
```

> 请求体 `months: list[int] | None` 多选月份，非空时优先于 `month`，缺省表示全年；结果同样 `ORDER BY random()` 均匀抽样。

**响应**：GeoJSON FeatureCollection（同 /points 格式）

PostGIS 查询：`ST_Within(geom, ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326))`

---

### GET /buffer — 缓冲区查询（点击地图 + 设置半径）

**参数**：
- `lat: float`, `lng: float` — 中心点
- `radius_km: float` — 搜索半径（公里）
- `species_key: int | None`
- `month: int | None` — 单月份（向后兼容）
- `months: list[int] | None` — 多选月份，重复传参 `months=8&months=9`；非空时优先于 `month`，缺省表示全年
- `limit: int = 500`

**示例**：`GET /api/v1/occurrence/buffer?lat=31.2&lng=121.5&radius_km=50`

**响应**：GeoJSON FeatureCollection

PostGIS 查询：`ST_DWithin(geom::geography, ST_MakePoint(:lng, :lat)::geography, :radius_m)`（球面距离，单位转换：`radius_km * 1000`）

---

## 统计接口 `/api/v1/stats`

### GET /monthly — 月度趋势（ECharts 折线图用）

**参数**：
- `species_key: int | None`
- `country_code: str | None`
- `year: int = 2024`
- `bbox: str | None` — 带则按范围实时聚合（地图联动），含面积护栏，同 `/species/rank`

**示例**：`GET /api/v1/stats/monthly?bbox=116,39,118,41`

**响应** `List[MonthlyTrendItem]`：
```json
[
  { "month": 8,  "record_count": 500, "individual_sum": 3261 },
  { "month": 9,  "record_count": 500, "individual_sum": 10257 },
  { "month": 10, "record_count": 500, "individual_sum": 4189 },
  { "month": 11, "record_count": 500, "individual_sum": 3915 }
]
```

---

### GET /province — 省级统计

**参数**：
- `country_code: str = "CN"`
- `month: int | None`
- `year: int = 2024`
- `species_key: int | None`
- `bbox: str | None` — 带则按范围实时聚合（地图联动），含面积护栏，同 `/species/rank`

**示例**：`GET /api/v1/stats/province?bbox=116,39,118,41&month=10`

**响应**：
```json
[
  { "state_province": "Beijing", "record_count": 1200 },
  { "state_province": "Zhejiang", "record_count": 980 }
]
```

---

### GET /grid — 网格聚合热力（中比例尺，Cesium 缩放 5–9）

**参数**：
- `bbox: str` — `"minx,miny,maxx,maxy"`
- `grid_size: float = 1.0` — 网格边长（度）
- `month: int | None`
- `year: int = 2024`
- `species_key: int | None`
- `max_cells: int = 10000`（硬上限）

**示例**：`GET /api/v1/stats/grid?bbox=70,20,140,55&grid_size=1`

**响应** GeoJSON FeatureCollection：
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[[116.0, 39.0], [117.0, 39.0], [117.0, 40.0], [116.0, 40.0], [116.0, 39.0]]] },
      "properties": {
        "record_count": 42,
        "individual_sum": 120,
        "center_lon": 116.5,
        "center_lat": 39.5
      }
    }
  ]
}
```

**实现**（2026-06-11 已落地）：
- `species_key` 为 null 且 `grid_size ∈ {1.0, 0.5}` → 查预聚合表 `occurrence_grid_monthly`（实测北美/欧洲 25–160ms，全球全月 ~360ms）。`month` 为空时按格子跨月求和。
- 否则（带 `species_key` 或非预聚合粒度）→ 实时聚合 `occurrence_clean`（前端此场景已缩放到局部 bbox）。
- **边界语义**：预聚合路径返回与 bbox 重叠的**完整边缘格**（`geom && bbox`），实时路径按落在 bbox 内的点裁切；二者在视口边缘约有 <1% 计数差异，对热力渲染无影响（全格更稳定）。bbox 完整覆盖区域时两路径总数精确一致。

---

### GET /migration — 物种迁徙重心（按月质心）

**参数**：
- `species_key: int` — **必填**
- `year: int = 2024`

**示例**：`GET /api/v1/stats/migration?species_key=2495414`

**响应**：
```json
[
  { "month": 8,  "center_lon": 14.98, "center_lat": 24.87, "record_count": 7493 },
  { "month": 9,  "center_lon": 18.67, "center_lat": 23.78, "record_count": 7886 },
  { "month": 10, "center_lon": 20.97, "center_lat": 22.21, "record_count": 8549 },
  { "month": 11, "center_lon": 25.39, "center_lat": 21.61, "record_count": 8272 }
]
```

**重要**：这是每月观测重心（`ST_Centroid(ST_Collect(geom))` 按月分组），**不是**单只鸟的 GPS 轨迹，不可描述为"个体迁徙路径"。

---

## GeoServer 接口 `/api/v1/geoserver`

所有操作通过 `services/geoserver.py` 调用 GeoServer REST API，认证信息来自 `settings`。

**鉴权**：写操作（POST / DELETE / PUT）需在请求头携带 `X-API-Key: <GEOSERVER_API_KEY>`，缺失或错误返回 `401`。密钥配置在 `.env` 的 `GEOSERVER_API_KEY`；留空表示**不启用鉴权**（仅本地开发）。GET 列表保持开放。

**已发布图层（第三阶段）**：`birdscope:occurrence_grid_monthly`（WMS/WFS），默认样式 `birdscope:grid_heatmap`（按 `record_count` 7 级 YlOrRd 分色）。
前端 WMS GetMap 应按需加 `CQL_FILTER` 过滤粒度与月份，例如全球 10 月 1.0° 热力：
```
.../birdscope/wms?service=WMS&version=1.1.0&request=GetMap
  &layers=birdscope:occurrence_grid_monthly&styles=
  &bbox=-180,-90,180,90&width=1024&height=512&srs=EPSG:4326
  &format=image/png&transparent=true&CQL_FILTER=grid_size=1.0 AND month=10
```
> 不加 `grid_size` 过滤会把 1.0° 与 0.5° 两档、各月份叠加渲染，导致重影；务必至少限定 `grid_size` 与 `month`。
> 一键初始化：`python scripts/setup_geoserver.py`（幂等，建 workspace+datastore+样式+发布图层）。

### GET /layers — 列出工作空间图层

**响应**：图层列表（无需鉴权）

---

### POST /layers — 发布新图层

**请求体**：
```json
{
  "layer_name": "cn_grid_monthly_m8",
  "table_name": "occurrence_grid_monthly",
  "style_name": "heatmap_blue",
  "cql_filter": "month=8 AND year=2024"
}
```

需请求头 `X-API-Key`（见本节开头鉴权说明）。

---

### DELETE /layers/{layer_name} — 删除图层

需请求头 `X-API-Key`。

---

### PUT /layers/{layer_name}/style — 切换图层样式

**请求体**：`{ "style_name": "grid_heatmap" }`，需请求头 `X-API-Key`。

---

## Pydantic Schema 参考

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
    species: str | None          # 可为 null
    scientific_name: str
    individual_count: int | None  # 可为 null
    event_date: date
    locality: str | None
    country_code: str
    state_province: str | None

class MonthlyTrendItem(BaseModel):
    month: int
    record_count: int
    individual_sum: int | None    # 可为 null（NULL 记录不计入）

class GridFeatureProperties(BaseModel):
    record_count: int
    individual_sum: int | None
    center_lon: float
    center_lat: float
```

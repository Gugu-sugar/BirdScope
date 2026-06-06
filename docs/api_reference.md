# BirdScope API 接口文档

> 来源整合：AGENT.md API 章节、BirdScope_后端进展说明.md  
> 基础前缀：`/api/v1` | 所有坐标 WGS-84（EPSG:4326）| 所有响应 JSON  
> 最后更新：2026-06-06

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

**示例**：`GET /api/v1/species/rank?country_code=CN&month=10`

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
- `month: int | None`
- `year: int = 2024`
- `limit: int = 2000`（硬上限 5000，禁止超越）

**示例**：`GET /api/v1/occurrence/points?bbox=70,20,140,55&month=10`

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
  "month": 10,
  "year": 2024,
  "limit": 2000
}
```

**响应**：GeoJSON FeatureCollection（同 /points 格式）

PostGIS 查询：`ST_Within(geom, ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326))`

---

### GET /buffer — 缓冲区查询（点击地图 + 设置半径）

**参数**：
- `lat: float`, `lng: float` — 中心点
- `radius_km: float` — 搜索半径（公里）
- `species_key: int | None`
- `month: int | None`
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

**示例**：`GET /api/v1/stats/monthly?country_code=CN`

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

**示例**：`GET /api/v1/stats/province?country_code=CN`

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

**实现**：`species_key` 为 null 时查 `occurrence_grid_monthly`（快）；`species_key` 存在时对 `occurrence_clean` 做实时 `ST_SnapToGrid` 聚合（200–500ms）。

---

### GET /migration — 物种迁徙重心（按月质心）

**参数**：
- `species_key: int` — **必填**
- `year: int = 2024`

**示例**：`GET /api/v1/stats/migration?species_key=5228134`

**响应**：
```json
[
  { "month": 8,  "center_lon": 116.4, "center_lat": 35.2, "record_count": 120 },
  { "month": 9,  "center_lon": 117.1, "center_lat": 33.8, "record_count": 145 },
  { "month": 10, "center_lon": 118.3, "center_lat": 31.5, "record_count": 98 },
  { "month": 11, "center_lon": 119.0, "center_lat": 28.2, "record_count": 67 }
]
```

**重要**：这是每月观测重心（`ST_Centroid(ST_Collect(geom))` 按月分组），**不是**单只鸟的 GPS 轨迹，不可描述为"个体迁徙路径"。

---

## GeoServer 接口 `/api/v1/geoserver`

所有操作通过 `services/geoserver.py` 调用 GeoServer REST API，认证信息来自 `settings`。

### GET /layers — 列出工作空间图层

**响应**：图层列表

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

⚠️ **当前无鉴权保护**，此接口可删除/发布 GeoServer 图层，联调前须加 API Key。

---

### DELETE /layers/{layer_name} — 删除图层

---

### PUT /layers/{layer_name}/style — 切换图层样式

**请求体**：`{ "style_name": "heatmap_red" }`

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

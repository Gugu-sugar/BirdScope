# BirdScope 前端 API 联调

> 最后更新：2026-06-16

API base：`VITE_API_BASE_URL`，默认 `http://localhost:8000/api/v1`。

## 已封装接口

| 前端函数 | 后端接口 | 使用方 |
|----------|----------|--------|
| `searchSpecies` | `GET /species/search` | `QueryPanel` |
| `queryOccurrenceByBbox` | `GET /occurrence/points` | `queryStore` |
| `queryOccurrenceWithin` | `POST /occurrence/within` | `queryStore` |
| `queryOccurrenceBuffer` | `GET /occurrence/buffer` | `queryStore` |
| `queryGrid` | `GET /stats/grid` | `MapPanel`（查询联动热力网格） |
| `querySpeciesRank` | `GET /species/rank` | `SpeciesRankChart` |
| `queryMonthlyTrend` | `GET /stats/monthly` | `MonthlyTrendChart` |
| `queryProvinceStats` | `GET /stats/province` | `RegionStatsChart` |
| `listGeoServerLayers` | `GET /geoserver/layers` | `LayerPanel` |
| `publishGeoServerLayer` | `POST /geoserver/layers` | `PublishLayerDialog` |

所有图表/网格请求均支持可选 `bbox` 与 `AbortSignal`；`bbox` 来自 `queryStore.activeQuery`（执行查询时的范围快照），月份取实时 `store.month`。

## 契约差异

### 物种搜索

后端当前响应是 `SpeciesItem[]`：

```json
[{ "species_key": 1, "display_name": "..." }]
```

前端类型和 `QueryPanel` 当前仍按以下形状读取：

```json
{ "results": [], "total": 0 }
```

联调时必须统一为一种格式。按当前后端文档，建议前端直接使用数组。

### 图表筛选（2026-06-16 已联动）

- `/stats/monthly`：`species_key` + `bbox`（按月跨月趋势，月份本身不作过滤）。
- `/stats/province`：`species_key` + `month` + `bbox`。
- `/species/rank`：`month` + `bbox`（**不支持** `species_key`——排行本身是跨物种 top-N，过滤到单物种无意义）。
- 三者带 `bbox` 时后端走 `occurrence_clean` 实时聚合，按地图框联动；不带时走预聚合事实表。bbox 面积超护栏自动回退预聚合。

### GeoServer 图层

全球热力图必须至少带：

```text
CQL_FILTER=grid_size=1.0 AND year=2024 AND month=10
```

`MapPanel` 当前使用 `CQL_FILTER` 接入 `birdscope:occurrence_grid_monthly`，并通过侧栏图层面板控制底图、矢量点位、联动热力网格和全球 WMS 的显示状态。

```ts
listGeoServerLayers();

publishGeoServerLayer({
  layer_name: "grid_m10_g1_202606161700",
  table_name: "occurrence_grid_monthly",
  style_name: "grid_heatmap",
  cql_filter: "grid_size=1 AND year=2024 AND month=10"
});
```

- `GET /geoserver/layers` 无需 API key，用于侧边栏“已发布图层”列表。
- `POST /geoserver/layers` 如后端配置了 `GEOSERVER_API_KEY`，前端需通过 `VITE_GEOSERVER_API_KEY` 或发布弹窗输入 `X-API-Key`。
- 当前发布语义固定为现成表 `occurrence_grid_monthly` + `grid_size/year/month` 的 `CQL_FILTER`；该表不含物种维度。
- WMS 地址可通过 `VITE_GEOSERVER_WMS_URL` 覆盖，默认 `http://localhost:8080/geoserver/birdscope/wms`。

## 空间约定

- 坐标系：WGS-84 / EPSG:4326
- bbox：`[minx, miny, maxx, maxy]`
- GeoJSON position：`[longitude, latitude]`
- 点查询默认 2000，硬上限 5000
- 网格硬上限 10000

所有可空字段必须按 [rules_and_conventions.md](rules_and_conventions.md) 展示。

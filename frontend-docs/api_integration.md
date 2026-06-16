# BirdScope 前端 API 联调

> 最后更新：2026-06-15

API base：`VITE_API_BASE_URL`，默认 `http://localhost:8000/api/v1`。

## 已封装接口

| 前端函数 | 后端接口 | 使用方 |
|----------|----------|--------|
| `searchSpecies` | `GET /species/search` | `QueryPanel` |
| `queryOccurrenceByBbox` | `GET /occurrence/points` | `queryStore` |
| `queryOccurrenceWithin` | `POST /occurrence/within` | `queryStore` |
| `queryOccurrenceBuffer` | `GET /occurrence/buffer` | `queryStore` |
| `queryGrid` | `GET /stats/grid` | 已封装，地图未消费 |
| `querySpeciesRank` | `GET /species/rank` | `SpeciesRankChart` |
| `queryMonthlyTrend` | `GET /stats/monthly` | `MonthlyTrendChart` |
| `queryProvinceStats` | `GET /stats/province` | `RegionStatsChart` |

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

### 图表筛选

- `/stats/monthly` 支持 `species_key`。
- `/species/rank` 不支持 `species_key`，只支持 `country_code/month/year/limit`。
- `/stats/province` 不支持 `species_key`，只支持 `country_code/month/year`。

前端目前向后两者发送 `species_key`，FastAPI 会忽略未知 query 参数，因此这些图表不会按选中物种过滤。

### WMS

全球热力图必须至少带：

```text
CQL_FILTER=grid_size=1.0 AND month=10
```

当前 `MapPanel` 使用 `viewparams`，与已发布普通 PostGIS FeatureType 图层的契约不一致。

## 空间约定

- 坐标系：WGS-84 / EPSG:4326
- bbox：`[minx, miny, maxx, maxy]`
- GeoJSON position：`[longitude, latitude]`
- 点查询默认 2000，硬上限 5000
- 网格硬上限 10000

所有可空字段必须按 [rules_and_conventions.md](rules_and_conventions.md) 展示。

# BirdScope 前端 API 联调说明

> 最后更新：2026-06-17
> 后端完整接口见：`../backend-docs/api_reference.md`

## API 客户端

入口：`frontend/src/api/client.ts`

```ts
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
```

- `buildQuery(params)`：过滤 `undefined`、`null`、空字符串后构造 query string。
- `requestJson<T>(path, options)`：统一 fetch、JSON 解析和错误抛出。
- `ApiError`：携带 HTTP status，错误信息优先读取后端 `detail`。

## 已封装接口

| 文件 | 函数 | 后端接口 | 当前 UI 使用 |
|------|------|----------|--------------|
| `api/species.ts` | `searchSpecies` | `GET /species/search` | ✅ 查询面板 |
| `api/occurrence.ts` | `queryOccurrenceByBbox` | `GET /occurrence/points` | ✅ 查询执行 |
| `api/occurrence.ts` | `queryOccurrenceWithin` | `POST /occurrence/within` | ✅ 查询执行 |
| `api/occurrence.ts` | `queryOccurrenceBuffer` | `GET /occurrence/buffer` | ✅ 查询执行 |
| `api/stats.ts` | `queryGrid` | `GET /stats/grid` | ✅ 联动热力网格 |
| `api/species.ts` | `querySpeciesRank` | `GET /species/rank` | ✅ 物种排行 |
| `api/stats.ts` | `queryMonthlyTrend` | `GET /stats/monthly` | ✅ 月度趋势 |
| `api/stats.ts` | `queryProvinceStats` | `GET /stats/province` | ✅ 区域统计 |
| `api/geoserver.ts` | `listGeoServerLayers` | `GET /geoserver/layers` | ✅ 图层面板 |
| `api/geoserver.ts` | `publishGeoServerLayer` | `POST /geoserver/layers` | ✅ 发布当前图层 |

## 查询参数约定

> **月份语义拆分**：查询表单用 `queryStore.queryMonths`（`number[]`，多选，空数组 = 全年），仅作用于观测点查询；显示月份 `queryStore.month` 单独驱动热力图层与统计图表，由「时空动态」时间轴控制，两者互不影响。`queryMonths` 为空时不发送 `months` 参数（即全年）。

> **未选范围默认全球**：`runCurrentQuery` 在当前模式无空间选区时，自动以全球 bbox `[-180,-90,180,90]` 走 `queryOccurrenceByBbox`（后端按面积自适应 `TABLESAMPLE` 随机采样，~0.5s）。

> **查询后自动隐藏全球热力**：查询成功后置 `layerVisibility.globalWms = false`，避免全球 WMS 热力与结果点位/联动网格叠加；图层面板对应复选框同步取消，用户可手动重开。结果点位（封顶 800、已聚合）不再随相机高度隐藏，全球范围查询也能看到结果。

### 矩形查询

```ts
queryOccurrenceByBbox({
  bbox: [70, 20, 140, 55],
  speciesKey,
  months,            // number[]，空表示全年
  year: 2024,
  limit: 800
});
```

发送到后端（多选月份序列化为重复参数）：

```text
GET /occurrence/points?bbox=70,20,140,55&species_key=...&months=9&months=10&year=2024&limit=800
```

### 多边形查询

```ts
queryOccurrenceWithin({
  geometry: {
    type: "Polygon",
    coordinates: [[[116, 39], [117, 39], [117, 40], [116, 40], [116, 39]]]
  },
  species_key: speciesKey,
  months,            // number[]，空表示全年
  year: 2024,
  limit: 800
});
```

### 缓冲区查询

```ts
queryOccurrenceBuffer({
  lat: 31.2,
  lng: 121.5,
  radiusKm: 50,
  speciesKey,
  months,            // number[]，空表示全年
  year: 2024,
  limit: 500
});
```

发送到后端时 `radiusKm` 转为 `radius_km`；后端返回点已 `ORDER BY random()` 均匀抽样，覆盖整个选区。

## 图表与网格联动

- `queryStore.activeQuery` 是执行查询时的快照：`{ speciesKey, speciesName, bbox }`。
- `/stats/grid`：使用 `activeQuery.bbox`、`activeQuery.speciesKey`、实时 `month`、实时 `gridSize`。
- `/stats/monthly`：使用 `species_key` + `bbox`，用于跨月趋势，月份本身不作为过滤。
- `/stats/province`：使用 `species_key` + `month` + `bbox`。
- `/species/rank`：使用 `month` + `bbox`；排行是跨物种 top-N，不传单物种过滤。

## GeoServer 图层

```ts
listGeoServerLayers();

publishGeoServerLayer({
  layer_name: "grid_m10_g1_202606171700",
  table_name: "occurrence_grid_monthly",
  style_name: "grid_heatmap",
  cql_filter: "grid_size=1 AND year=2024 AND month=10"
});
```

- `GET /geoserver/layers` 无需 API key，用于侧边栏“已发布图层”列表。
- `POST /geoserver/layers` 如后端配置了 `GEOSERVER_API_KEY`，前端需通过 `VITE_GEOSERVER_API_KEY` 或发布弹窗输入 `X-API-Key`。
- 当前发布语义固定为现成表 `occurrence_grid_monthly` + `grid_size/year/month` 的 `CQL_FILTER`；该表不含物种维度。
- WMS 地址可通过 `VITE_GEOSERVER_WMS_URL` 覆盖，默认 `http://localhost:8080/geoserver/birdscope/wms`。

## WMS

`MapPanel` 使用普通 PostGIS FeatureType 图层，必须通过 `CQL_FILTER` 过滤：

```text
CQL_FILTER=grid_size=1 AND year=2024 AND month=10
```

`grid_size` 来自图层面板，`month` 来自时间滑块。

## TypeScript 响应类型

主要类型位于 `frontend/src/types/api.ts`：

- `SpeciesItem`
- `OccurrenceGeoJSON`
- `OccurrenceFeature`
- `GridGeoJSON`
- `WithinQueryBody`

展示时必须兼容：

- `species: null`
- `scientific_name: null`
- `individual_count: null`
- `event_date: null`
- `locality: null`
- `country_code: null`
- `state_province: null`

## 坐标约定

- 坐标系：WGS-84 / EPSG:4326。
- bbox：`[minx, miny, maxx, maxy]`，也就是 `[最小经度, 最小纬度, 最大经度, 最大纬度]`。
- GeoJSON position：`[longitude, latitude]`。
- 缓冲区中心：前端内部用 `{ lng, lat }`，请求后端时传 `lng` 和 `lat`。

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
- `requestJson<T>(path, options)`：统一 fetch、JSON 解析和错误抛出。`options` 先展开、`headers` 后合并，确保自定义头（如 `X-API-Key`）不会覆盖掉默认 `Content-Type: application/json`（曾因展开顺序颠倒导致带头 POST 丢失 JSON content-type，被 FastAPI 判 422）。
- `ApiError`：携带 HTTP status，错误信息优先读取后端 `detail`；`detail` 为 FastAPI 422 校验数组时，逐项拼为 `字段: 原因` 文本，不再丢成笼统的“请求失败：422”。

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
| `api/geoserver.ts` | `publishGeoServerLayer` | `POST /geoserver/layers` | ✅ 发布弹窗·预聚合模式 |
| `api/geoserver.ts` | `publishSpeciesGridLayer` | `POST /geoserver/species-grid` | ✅ 发布弹窗·实时聚合模式 |
| `api/geoserver.ts` | `deleteGeoServerLayer` | `DELETE /geoserver/layers/{name}` | ✅ 图层面板·删除按钮 |

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

// 模式一：预聚合 · 全物种（现成表 + CQL_FILTER，快）
publishGeoServerLayer({
  layer_name: "grid_m10_g1_202606171700",
  table_name: "occurrence_grid_monthly",
  style_name: "grid_heatmap",
  cql_filter: "grid_size=1 AND year=2024 AND month=10"
});

// 模式二：实时聚合 · 当前物种（SQL View 虚拟表，需已选物种）
publishSpeciesGridLayer({
  layer_name: "grid_sp2486131_m10_g1_202606171700",
  species_key: 2486131,
  grid_size: 1,
  month: 10,         // 省略/undefined = 全年
  year: 2024,
  style_name: "grid_heatmap"
});
```

- `GET /geoserver/layers` 无需 API key，用于侧边栏“已发布图层”列表。
- 两个 POST 接口如后端配置了 `GEOSERVER_API_KEY`，前端需通过 `VITE_GEOSERVER_API_KEY` 或发布弹窗输入 `X-API-Key`。
- **发布弹窗（`PublishLayerDialog`）双模式**：
  - 「预聚合 · 全物种」→ `publishGeoServerLayer`，按 `occurrence_grid_monthly` + `grid_size/year/month` 的 `CQL_FILTER`；该表不含物种维度。
  - 「实时聚合 · 当前物种」→ `publishSpeciesGridLayer`，从 `occurrence_clean` 按所选物种聚合；**仅当查询面板已选物种时可用**，打开弹窗若已选物种则默认此模式。
  - 两种模式都复用 `grid_heatmap` 样式；图层名按模式自动生成（实时聚合带 `sp{species_key}` 前缀）。
- WMS 地址可通过 `VITE_GEOSERVER_WMS_URL` 覆盖，默认 `http://localhost:8080/geoserver/birdscope/wms`。
- **物种图层 WMS 无需再加 `CQL_FILTER`**（物种/月份/粒度已固化进虚拟表 SQL）。

### 已发布图层的显示与删除（图层面板）

- **显示/隐藏**：列表每个非默认图层有 👁 开关，切换 `queryStore.displayedLayers`（图层名数组）。`MapPanel` 监听该数组，按名增删静态 WMS 叠加层（`layers=birdscope:{name}`，**不带 CQL_FILTER**，过滤已固化进图层）。叠加层置于天地图注记之下。
- **删除**：🗑 按钮 → `window.confirm` 二次确认 → `deleteGeoServerLayer(name)`（`X-API-Key` 取 `VITE_GEOSERVER_API_KEY`）→ 成功后 `removePublishedLayer(name)` 清掉地图叠加 + 重新拉列表。
- **默认层保护**：`occurrence_grid_monthly` 在列表中标「默认」🔒，不可删除，也不提供静态叠加开关——它由「显示图层」区的「全球 WMS」开关 + 动态 `CQL_FILTER`（`grid_size/year/month`）控制；静态叠加不带 CQL 会令各月份/粒度重影。常量 `PROTECTED_LAYER` 定义在 `LayerPanel.tsx`。

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

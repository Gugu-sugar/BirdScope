# BirdScope 前端 API 联调说明

> 最后更新：2026-06-14  
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
| `api/species.ts` | `searchSpecies` | `GET /species/search` | ✅ |
| `api/occurrence.ts` | `queryOccurrenceByBbox` | `GET /occurrence/points` | ✅ |
| `api/occurrence.ts` | `queryOccurrenceWithin` | `POST /occurrence/within` | ✅ |
| `api/occurrence.ts` | `queryOccurrenceBuffer` | `GET /occurrence/buffer` | ✅ |
| `api/stats.ts` | `queryGrid` | `GET /stats/grid` | 待接入地图层 |

## 查询参数约定

### 矩形查询

```ts
queryOccurrenceByBbox({
  bbox: [70, 20, 140, 55],
  speciesKey,
  month,
  year: 2024,
  limit: 2000
});
```

发送到后端：

```text
GET /occurrence/points?bbox=70,20,140,55&species_key=...&month=...&year=2024&limit=2000
```

### 多边形查询

```ts
queryOccurrenceWithin({
  geometry: {
    type: "Polygon",
    coordinates: [[[116, 39], [117, 39], [117, 40], [116, 40], [116, 39]]]
  },
  species_key: speciesKey,
  month,
  year: 2024,
  limit: 2000
});
```

### 缓冲区查询

```ts
queryOccurrenceBuffer({
  lat: 31.2,
  lng: 121.5,
  radiusKm: 50,
  speciesKey,
  month,
  year: 2024,
  limit: 500
});
```

发送到后端时 `radiusKm` 转为 `radius_km`。

## TypeScript 响应类型

主要类型位于 `frontend/src/types/api.ts`：

- `SpeciesItem`
- `SpeciesSearchResult`
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

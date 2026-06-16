# BirdScope 前端技术架构

> 最后更新：2026-06-15

## 目录

```text
frontend/src/
├── main.tsx
├── App.tsx
├── styles.css
├── pages/MapQueryPage.tsx
├── components/
│   ├── map/MapPanel.tsx
│   ├── query/QueryPanel.tsx
│   ├── query/ResultList.tsx
│   └── charts/
│       ├── TimeSlider.tsx
│       ├── SpeciesRankChart.tsx
│       ├── MonthlyTrendChart.tsx
│       └── RegionStatsChart.tsx
├── store/queryStore.tsx
├── api/client.ts
├── api/occurrence.ts
├── api/species.ts
├── api/stats.ts
└── types/api.ts, geo.ts
```

## 组件关系

```text
App
└── QueryProvider
    └── MapQueryPage
        ├── QueryPanel
        ├── MapPanel
        ├── TimeSlider
        ├── SpeciesRankChart
        ├── MonthlyTrendChart
        └── RegionStatsChart
```

`ResultList` 当前未挂载到组件树。

## 状态流

`QueryProvider` 管理：

- `selectedSpecies`
- `month`
- `spatialMode`
- `bbox` / `polygon` / `buffer`
- `radiusKm`
- `results`
- `loading` / `error`

`runCurrentQuery()` 根据空间模式调用对应 occurrence API。地图订阅 `results` 并将 GeoJSON 点转换为 Cesium entity；图表直接根据月份和物种参数请求统计 API。

## 地图分层

| 视图 | 设计数据源 | 当前状态 |
|------|------------|----------|
| 全球 | GeoServer WMS `occurrence_grid_monthly` | 已接代码，过滤参数需修正 |
| 区域 | `/api/v1/stats/grid` | API 已封装，尚未绘制网格层 |
| 本地 | `/api/v1/occurrence/points` 等 | 查询结果已回绘为 Cesium 点 |

## 风险点

- `MapPanel` 直接访问 Cesium provider 私有 `_parameters`，升级 Cesium 时不稳定。
- 地图交互中仍有多处 `any`，类型保护不足。
- WMS 地址硬编码为 `localhost:8080`，尚未环境变量化。
- 图表请求缺少显式 error/empty 展示和请求取消。


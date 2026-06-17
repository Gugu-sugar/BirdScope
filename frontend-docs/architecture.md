# BirdScope 前端技术架构

> 最后更新：2026-06-17

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
│   ├── layers/
│   │   ├── LayerPanel.tsx
│   │   └── PublishLayerDialog.tsx
│   └── charts/
│       ├── InsightPanel.tsx
│       ├── TimeSlider.tsx
│       ├── SpeciesRankChart.tsx
│       ├── MonthlyTrendChart.tsx
│       └── RegionStatsChart.tsx
├── store/queryStore.tsx
├── api/client.ts
├── api/geoserver.ts
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
        ├── 顶栏发布按钮
        ├── 左侧 icon rail
        │   └── 抽屉面板
        │       ├── QueryPanel
        │       ├── ResultList
        │       ├── InsightPanel
        │       └── LayerPanel
        ├── MapPanel
        ├── FloatingInfoCard
        └── PublishLayerDialog
```

## 状态流

`QueryProvider` 管理：

- 查询条件：`selectedSpecies`、`month`、`spatialMode`、`bbox` / `polygon` / `buffer`、`radiusKm`
- 查询结果：`results`、`activeQuery`、`loading`、`error`
- 点位联动：`selectedGbifId`
- 图层控制：`basemap`、`gridSize`、`layerVisibility`

`runCurrentQuery()` 根据空间模式调用 occurrence API。查询成功后写入 `results` 和 `activeQuery`，并清空旧的 `selectedGbifId`。

## 地图分层

| 图层 | 数据源 | 控制方式 |
|------|--------|----------|
| 底图 | OSM / ArcGIS World Imagery / ArcGIS Topographic | `LayerPanel` 选择 `basemap` |
| 全球热力 | GeoServer WMS `occurrence_grid_monthly` | `gridSize` + `month` 生成 `CQL_FILTER`，`layerVisibility.globalWms` 控制显隐 |
| 区域热力 | `/api/v1/stats/grid` | `activeQuery.bbox` + `speciesKey` + `month` + `gridSize`，`layerVisibility.grid` 控制显隐 |
| 本地点位 | occurrence 查询结果 | `results.features` 转 Cesium entity，`layerVisibility.points` 控制显隐 |

## 绘制交互

- 左上角 `DrawingGuide` 根据 `spatialMode` 展示当前操作说明。
- bbox 模式：第一次左键记录起点，鼠标移动更新 `preview-rect` 橡皮筋矩形，第二次左键完成范围。
- polygon 模式：左键添加顶点，至少 3 点后右键闭合；右键不会再额外添加当前鼠标点。
- buffer 模式：左键选择中心点，半径来自查询面板。
- 切换绘制模式时清理 `draw-start`、`preview-rect` 和 `tp-*` 临时实体。

## 点位联动

- 地图点位 entity id 固定为 `pt-${gbif_id}`。
- 地图点选写入 `selectedGbifId`，页面内 `ObservationPopup` 跟随点位。
- `ResultList` 点击同样写入 `selectedGbifId`，地图点位高亮并 `flyTo`。
- 右侧 `FloatingInfoCard` 显示当前选中点位摘要。

## GeoServer 发布

- `LayerPanel` 调 `GET /geoserver/layers` 展示已发布图层。
- `PublishLayerDialog` 调 `POST /geoserver/layers` 发布现成表 `occurrence_grid_monthly`。
- 当前发布语义为 `grid_size/year/month` 的 CQL 过滤，不包含物种维度。

## 风险点

- Cesium 和 ECharts 仍然导致生产 bundle 较大，后续可做动态 import 或 manualChunks。
- 批次⑤尚未做完整按相机高度自动分级渲染和热力观感优化。

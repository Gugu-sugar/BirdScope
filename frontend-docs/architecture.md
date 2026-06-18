# BirdScope 前端技术架构

> 最后更新：2026-06-18

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
├── lib/adaptiveGrid.ts          # 联动热力按范围面积自适应粒度
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
- 图层控制：`basemap`、`gridSize`、`layerVisibility`、`displayedLayers`（已发布图层在地图上的静态叠加显隐）

`runCurrentQuery()` 根据空间模式调用 occurrence API。查询成功后写入 `results` 和 `activeQuery`，并清空旧的 `selectedGbifId`。

## 地图分层

| 图层 | 数据源 | 控制方式 |
|------|--------|----------|
| 底图 + 注记 | 天地图 WMTS（矢量 vec / 影像 img / 地形 ter + 注记 cva/cia/cta） | `LayerPanel` 选择 `basemap`；注记单独持有并 `raiseToTop` 盖在热力图之上 |
| 全球热力 | GeoServer WMS `occurrence_grid_monthly` | `gridSize` + `month` 生成 `CQL_FILTER`，`layerVisibility.globalWms` 控制显隐 |
| 区域热力 | `/api/v1/stats/grid` | `activeQuery.bbox` + `speciesKey` + `month`，**粒度按范围面积自适应**（`lib/adaptiveGrid.ts`），`layerVisibility.grid` 控制显隐 |
| 已发布图层叠加 | GeoServer WMS（含 `species-grid` 虚拟表） | `displayedLayers` 数组，`MapPanel` 据此增删静态 WMS 层，**不带 CQL**（过滤已固化进图层）|
| 本地点位 | occurrence 查询结果 | `results.features` 转 Cesium entity（开原生聚合），`layerVisibility.points` 控制显隐 |

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

## GeoServer 发布与管理

- `LayerPanel` 调 `GET /geoserver/layers` 展示已发布图层，每个非默认图层提供 👁 显隐叠加（切 `displayedLayers`）与 🗑 删除（`deleteGeoServerLayer`，`confirm` 二次确认）。
- 默认层 `occurrence_grid_monthly` 受保护（常量 `PROTECTED_LAYER`）：标「默认」🔒，不可删除，也不提供静态叠加开关（它走「全球 WMS」动态 CQL）。
- `PublishLayerDialog` 双模式发布：
  - 预聚合·全物种 → `POST /geoserver/layers`，按 `occurrence_grid_monthly` + `grid_size/year/month` 的 CQL，不含物种维度。
  - 实时聚合·当前物种 → `POST /geoserver/species-grid`，后端用 SQL View 虚拟表从 `occurrence_clean` 按物种聚合补齐物种维度，输出与预聚合表同构、复用 `grid_heatmap` 样式。
- 写操作 `X-API-Key` 取 `VITE_GEOSERVER_API_KEY`，或发布弹窗手填。详见 [api_integration.md](api_integration.md)。

## 风险点

- Cesium 和 ECharts 仍然导致生产 bundle 较大，后续可做动态 import 或 manualChunks。
- 批次⑤尚未做完整按相机高度自动分级渲染和热力观感优化。

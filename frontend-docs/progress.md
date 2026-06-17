# BirdScope 前端开发进展

> 最后更新：2026-06-17

## 状态

| 功能 | 状态 | 说明 |
|------|------|------|
| Vite + React + TypeScript + Tailwind | 完成 | 可安装和生产构建 |
| 查询面板和 QueryProvider | 完成 | 三种空间模式已接线，并维护查询快照、选中点位、图层控制状态 |
| Cesium 主场景 | 已整合 | 初始化、空间绘制提示、矩形预览、点位展示、回正按钮、ResizeObserver 自适应已实现 |
| GeoServer WMS | 已整合 | 使用 `CQL_FILTER`，随月份和网格粒度更新 |
| 时间滑块 | 已合入 | 支持 8–11 月播放 |
| ECharts 图表 | 已联动 | 三图表按 `activeQuery`（物种+范围）+ 实时月份联动，带 AbortController |
| ResultList | 已联动 | 结果列表与地图点位共享 `selectedGbifId`，支持双向选中、高亮、滚动定位 |
| `/stats/grid` 区域网格层 | 已接入 | 执行查询后按 bbox+物种+月份+网格粒度拉网格，clampToGround 分级配色 |
| 图层管理 | 已整合 | 左侧图层面板支持底图切换、矢量点位/热力网格/全球 WMS 开关、已发布图层列表（含显隐切换 + 删除，默认层受保护） |
| 发布当前图层 | 已整合 | 顶栏按钮打开发布弹窗，双模式：预聚合·全物种（`occurrence_grid_monthly`+CQL）/ 实时聚合·当前物种（`/geoserver/species-grid`，选了物种时默认） |
| 前端自动化测试 | 待做 | 暂无测试框架和用例 |

## 三批次整合（2026-06-17）

- 批次①：地图点位点击由浏览器 `alert()` 改为页面内气泡；`ResultList` 与地图点位通过 `selectedGbifId` 双向联动。
- 批次②：页面改为地图优先布局，左侧 icon rail + 抽屉面板，右侧常驻上下文卡；删除地图标题栏、示例按钮和页面底栏；新增 Cesium 回正按钮。
- 批次③：图层管理面板接入底图切换、图层显隐、网格粒度、GeoServer 已发布图层列表；顶栏“发布当前图层”接入 `POST /geoserver/layers`。
- 批次④：地图左上增加绘制提示；矩形框选增加橡皮筋预览；多边形右键闭合逻辑修正；删除全屏暗角掩膜。

## UI/UX 修复与月份语义拆分（2026-06-17）

- **侧栏 tooltip 遮挡**：rail `nav` 提到 `z-30`（高于 360px 抽屉 aside），hover 提示不再被面板盖住。
- **清空选区**：`queryStore` 新增 `clearSpatialSelection`（清空 bbox/polygon/buffer + 结果）；`QueryPanel` 空间筛选区在有选区时显示「清空选区」按钮。
- **重复标题清理**：删除 `QueryPanel`、`InsightPanel` 内部各自的 `panel-header`，标题统一由 `MapQueryPage` 抽屉头承担（含原先无功能的装饰图标 / badge）。
- **月份语义拆分**：原单一 `store.month` 一身二职（既是查询条件又是显示图层）。现拆为：
  - `queryMonths: number[]`（查询表单多选，空 = 全年），`toggleQueryMonth` 切换，仅作用于观测点查询；
  - `month: number | null`（显示月份）保留驱动热力图层 + 统计图表 + 时空动态时间轴。
  - `QueryPanel` 月份按钮改多选 toggle，不再影响地图图层。
- **结果均匀分布 + 限额**：后端观测点查询改 `ORDER BY random()`，bbox/polygon 默认 `limit` 降到 800；返回点铺满整个选区，不再集中一角。
- **面板弹出动画**：抽屉改为常驻 + `width/opacity/margin` 过渡（180ms ease-out）；`displayedPanel` 在收缩期保留上一面板内容避免空盒塌陷；父容器去 `gap`、改 margin 控制间距，收起后栏与地图保持 12px。

## 底图/图层/交互二轮优化（2026-06-17）

- **双标题清理（续）**：删除 `ResultList`、`LayerPanel` 内部 `panel-header`；结果计数改由 rail 按钮角标体现。
- **时空动态时间轴**：`TimeSlider` 四按钮 + 静态进度条 → 原生 `<input type="range">`（8–11 月，拖动即切 `month`），保留播放/重置，下方月份刻度做参照。
- **矢量点聚合**：结果 `DataSource` 开 Cesium 原生聚合（`pixelRange=28`、`minimumClusterSize=3`），过密点合并为带数量圆泡（黄→红按密度），放大自动散开，解决重叠观感。
- **底图全面国内化**：街道/影像/地形改用天地图 WMTS（`vec`/`img`/`ter` + 注记 `cva`/`cia`/`cta`），`createBasemapProviders` 返回 `{base,label}` 双层；token 暂硬编码于 `MapPanel`（后续可迁 `VITE_TIANDITU_TOKEN`）。
- **注记盖在热力图之上**：注记层 `labelLayerRef` 单独持有，底图置底、注记 `raiseToTop`；WMS 热力重建后再次 `raiseToTop` 注记，保证地名清晰。注：贴地的联动网格（`/stats/grid` 实体）渲染层级恒在影像图层之上，注记无法盖其上。
- **未选范围默认全球查询** + **查询后自动隐藏全球 WMS 热力**：见 [api_integration.md](api_integration.md)；结果点位不再随相机高度隐藏。
- **清空选区按钮可用条件修正**：原仅在有 bbox/polygon/buffer 时显示，导致"未选范围的全球查询"结果无法清空；改为"有选区**或**有结果"时显示（`clearSpatialSelection` 本就同时清选区+结果）。
- **浮动卡片月份显示修正**：「当前地图上下文」卡片原显示**显示月份** `month`（时间轴控制、默认 10），与查询脱节；改为显示查询的**迁徙月份** `queryMonths`——不选=「全年」、单选「10 月」、多选「9、10 月」，标签同步改为「迁徙月份」。
- **发布弹窗按物种发布（方案 B）**：`PublishLayerDialog` 加「数据源」双模式——预聚合·全物种（原 `POST /geoserver/layers`）/ 实时聚合·当前物种（新 `POST /geoserver/species-grid`）。选了物种打开弹窗默认实时聚合模式，未选物种该模式禁用并提示；发布参数面板分模式展示，图层名实时聚合带 `sp{species_key}` 前缀；`month=null`（全年）正确不拼月份过滤。
- **修复 `api/client.ts` 带头 POST 报 422 的真实 bug**：对象展开顺序颠倒（`...options` 在 `headers` 之后）导致自定义头覆盖整个 `headers`、丢失 `Content-Type: application/json`，发布/删除/改样式等带 `X-API-Key` 的 POST 全部被 FastAPI 判 422；改为 `options` 先展开、`headers` 后合并。顺带让 `requestJson` 能解析 FastAPI 422 校验数组 `detail`。
- **已发布图层显隐切换 + 删除**：图层面板列表每个非默认图层加 👁 显隐（切 `store.displayedLayers`，`MapPanel` 据此增删静态 WMS 叠加层，不带 CQL）与 🗑 删除（`confirm` → `deleteGeoServerLayer` → 清叠加 + 刷新列表）。默认层 `occurrence_grid_monthly` 标「默认」🔒 受保护、不可删除、不提供静态叠加开关（它走「全球 WMS」动态 CQL）。`X-API-Key` 取 `VITE_GEOSERVER_API_KEY`。详见 [api_integration.md](api_integration.md)。

## 查询联动

- `queryStore.activeQuery` 在执行查询成功时写入 `{speciesKey, speciesName, bbox}`，三种空间模式（bbox/polygon/buffer）统一归一为 bbox。
- 物种与空间范围在快照时固定；显示月份 `store.month` 仍实时提供，便于时间滑块播放时图层/图表跟随；查询月份 `store.queryMonths` 独立，互不影响。
- 图层（`/stats/grid`）与三个图表（rank/monthly/province）均订阅 `activeQuery` + 月份。
- 新查询会清空旧的 `selectedGbifId`，避免列表/地图选中态指向过期点位。

## 后续待做

1. 批次⑤：热力观感和更完整的按相机高度自动分级渲染。
2. 补前端自动化测试，至少覆盖 API client、query store、关键组件冒烟。
3. 评估 Cesium/ECharts 代码分包，降低生产构建大 chunk 提示。

## 数据解释

页面必须持续显示：数据仅覆盖 2024 年 8–11 月；热力和图表表达观测记录/采样密度，不等同真实种群丰度。

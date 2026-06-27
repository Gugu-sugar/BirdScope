# BirdScope 前端概览

> 最后更新：2026-06-27

## 页面结构

入口：`frontend/src/pages/MapQueryPage.tsx`。布局为**地图优先**：左侧 icon rail 呼出抽屉面板，中央 Cesium 主画布，右侧常驻悬浮信息卡，顶栏一个「发布当前图层」入口。

| 区域 | 组件 | 当前职责 |
|------|------|----------|
| 左侧 rail + 抽屉 | `QueryPanel` | 物种搜索、月份多选、空间模式、缓冲半径、执行查询 |
| 左侧 rail + 抽屉 | `ResultList` | 查询结果列表，与地图点位双向选中联动 |
| 左侧 rail + 抽屉 | `InsightPanel`（`TimeSlider` + 三图表）| 时间轴、物种排行、月度趋势、区域统计 |
| 左侧 rail + 抽屉 | `LayerPanel` | 底图切换、图层显隐、已发布图层管理 |
| 中央 | `MapPanel` | Cesium、WMS、空间绘制、查询范围与观测点展示 |
| 右侧 | `FloatingInfoCard` | 当前地图上下文 + 数据免责声明（常驻可见）|
| 顶栏 | `PublishLayerDialog` | 发布当前图层（双模式）|

## 工作流

```text
QueryPanel / Cesium MapPanel
    -> QueryProvider
    -> frontend/src/api/*
    -> FastAPI /api/v1
    -> Cesium 点位·热力 / ECharts / ResultList
```

## 当前能力

- 三种空间查询：bbox、polygon、buffer；未选范围默认全球查询
- 月份多选查询（`queryMonths`）与显示月份（`month`，驱动图层/图表/时间轴）语义拆分
- Cesium 点位展示（原生聚合）、点击页面内气泡、结果列表双向联动
- 全球 WMS 热力（`CQL_FILTER` 切月 + 网格粒度）
- 区域联动热力 `/stats/grid`，粒度按查询范围面积自适应
- 时空动态时间轴（8–11 月）+ 三类统计图表联动
- 图层管理：底图切换、图层显隐、已发布图层显隐叠加 + 删除
- 发布当前图层：预聚合·全物种 / 实时聚合·当前物种

## 当前范围之外（开题拓展目标，未实现）

- 制图导出、卷帘 / 分屏对比、物种信息卡片、LLM 接入
- 按相机高度自动分级渲染与热力观感的进一步打磨（见 [progress.md](progress.md)）
- 前端自动化测试


# BirdScope 前端概览

> 最后更新：2026-06-15

## 页面结构

入口：`frontend/src/pages/MapQueryPage.tsx`

| 区域 | 组件 | 当前职责 |
|------|------|----------|
| 左侧 | `QueryPanel` | 物种搜索、月份、空间模式、缓冲半径、执行查询 |
| 中央 | `MapPanel` | Cesium、WMS、空间绘制、查询范围和观测点展示 |
| 右侧 | `TimeSlider`、三个 ECharts 图表 | 月份播放、物种排行、月度趋势、区域统计 |
| 独立组件 | `ResultList` | 已实现结果列表，但当前页面未渲染 |

## 工作流

```text
QueryPanel / Cesium MapPanel
    -> QueryProvider
    -> frontend/src/api/*
    -> FastAPI /api/v1
    -> Cesium 点位 / ECharts / ResultList
```

## 当前能力

- 三种空间查询：bbox、polygon、buffer
- 月份：2024 年 8–11 月
- Cesium 点位展示和点击信息
- 全球 WMS 热力图图层
- 时间滑块自动播放
- 三类统计图表

## 尚未完成

- 前后端物种搜索响应契约统一
- WMS `CQL_FILTER` 正确切月和限定网格尺寸
- 中比例尺 `/stats/grid` GeoJSON 网格层接入
- 恢复结果列表或设计地图/列表切换布局
- 前端自动化测试、错误态和请求竞态处理
- 制图导出、卷帘对比等开题拓展目标


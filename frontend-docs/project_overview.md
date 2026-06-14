# BirdScope 前端概览

> 最后更新：2026-06-14

## 前端定位

BirdScope 前端负责把后端鸟类观测数据组织成可交互的三维地图查询体验。当前代码已先落地查询工作台骨架，用于验证前后端数据流：

1. 输入物种关键词，调用后端物种搜索接口。
2. 选择 2024 年 8-11 月的迁徙季月份。
3. 选择空间筛选模式：矩形、多边形、缓冲区。
4. 执行查询，展示后端返回的 GeoJSON 观测点列表。

## 当前页面

入口页面：`frontend/src/pages/MapQueryPage.tsx`

页面分为三块：

| 区域 | 组件 | 职责 |
|------|------|------|
| 左侧查询面板 | `QueryPanel` | 物种搜索、月份选择、空间模式、缓冲半径、执行查询 |
| 中央地图面板 | `MapPanel` | 目前提供空间范围预览和样例写入；后续接入 Cesium |
| 右侧结果列表 | `ResultList` | 展示查询返回的 GeoJSON FeatureCollection |

## 当前能力

- 物种自动补全：`GET /api/v1/species/search`
- 矩形点查询：`GET /api/v1/occurrence/points`
- 多边形内点查询：`POST /api/v1/occurrence/within`
- 缓冲区点查询：`GET /api/v1/occurrence/buffer`
- 网格聚合 API 封装：`GET /api/v1/stats/grid`，当前 UI 尚未消费
- 响应式三栏布局：移动端单列，桌面端查询/地图/结果三栏

## 当前非目标

- `MapPanel` 尚不是 Cesium 场景，只是地图接入占位和查询范围预览。
- 当前没有图表面板，`stats/monthly`、`stats/province`、`species/rank` 尚未封装。
- 当前没有路由系统，应用入口只有一个工作台页面。
- 当前没有前端测试用例。


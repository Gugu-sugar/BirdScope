# BirdScope 前端规则与开发规范

> 最后更新：2026-06-15

## 数据展示规则

1. `species` 可能为 `null`，展示名称应 fallback 到 `scientific_name`。
2. `individual_count` 可能为 `null`，前端展示为“数量未知”，不可改写为 0 或 1。
3. `event_date`、`locality`、`country_code`、`state_province` 都要按可空字段处理。
4. `/stats/migration` 表示各月观测重心，不是单只鸟 GPS 轨迹；前端文案不可写成“个体迁徙路径”。
5. 热力和统计图应明确展示的是记录密度或记录数，不直接等同真实种群丰度。

## 空间规则

- 所有经纬度使用 WGS-84 / EPSG:4326。
- 所有坐标数组保持经度在前、纬度在后。
- bbox 格式固定为 `[minx, miny, maxx, maxy]`。
- Cesium 接入时，如果内部 API 使用弧度或 Cartesian 坐标，必须在边界层转换回后端约定的经纬度。
- 前端不应突破后端点查询硬上限；默认保留 `limit=2000`，必要时也不得超过 5000。

## 组件约定

- 页面级组合放在 `src/pages/`。
- 查询控件放在 `src/components/query/`。
- 地图相关 UI 和 Cesium 封装放在 `src/components/map/`。
- 请求封装统一放在 `src/api/`，组件不要直接拼完整 URL。
- 后端响应类型放在 `src/types/api.ts`，空间几何类型放在 `src/types/geo.ts`。
- 跨组件共享的查询状态继续由 `QueryProvider` 管理，除非状态复杂到需要引入专门状态库。

## UI 约定

- 当前界面是工作台，不做营销式首页。
- 控件保持紧凑、可扫描、适合反复查询。
- 按钮和状态应尽量使用 `lucide-react` 图标。
- 卡片圆角保持 8px 左右，避免过度装饰。
- 文案直接描述当前数据和操作，不写“功能介绍式”大段说明。
- 移动端应保持单列可滚动，桌面端维持查询、地图、结果三栏。

## 编码约定

- TypeScript 类型优先从 `types/` 复用，不在组件里重复定义后端响应形状。
- 异步请求必须展示 loading 和 error 状态。
- 物种搜索继续使用 debounce，避免每次键入都请求后端。
- 保存中文文件时使用 UTF-8。
- 环境变量只通过 `import.meta.env.VITE_*` 读取。


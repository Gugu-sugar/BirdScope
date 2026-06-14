# BirdScope 前端开发进展

> 最后更新：2026-06-14

## 当前状态总览

| 阶段 | 状态 | 说明 |
|------|------|------|
| Vite + React + TypeScript 项目骨架 | ✅ 完成 | `frontend/` 已可独立启动和构建 |
| Tailwind CSS 样式体系 | ✅ 完成 | `styles.css` 定义工作台基础视觉和地图占位样式 |
| 查询工作台页面 | ✅ 完成 | `MapQueryPage` 组合查询、地图、结果三栏 |
| 物种搜索 | ✅ 完成 | 已接入 `GET /species/search` |
| 空间查询数据流 | ✅ 完成 | bbox / polygon / buffer 三种模式已接入状态和请求 |
| 观测点结果列表 | ✅ 完成 | 展示 GeoJSON 点位属性和 null fallback |
| 网格统计接口封装 | ✅ 完成 | `queryGrid` 已封装，尚未在 UI 消费 |
| Cesium 地图场景 | ⏳ 待做 | 当前为地图占位和样例空间范围按钮 |
| GeoServer WMS 热力图 | ⏳ 待做 | 后端图层已发布，前端尚未接入 |
| 图表面板 | ⏳ 待做 | 月度趋势、省级统计、物种排行待封装和展示 |
| 前端自动化测试 | ⏳ 待做 | 暂无测试框架和用例 |

## 已完成详情

- `QueryProvider` 统一管理查询条件、空间选择、结果、加载和错误。
- `QueryPanel` 支持物种搜索、月份选择、空间模式选择和缓冲半径输入。
- `MapPanel` 支持用样例按钮写入三类空间范围，保留后续地图绘制回调契约。
- `ResultList` 支持 loading、error、empty、success 四类状态。
- API 客户端支持统一 base URL、query 构建和错误 detail 读取。

## 下一步建议

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | 接入 Cesium 绘制 | 用真实地图交互替换 `MapPanel` 样例按钮 |
| P0 | 接入 `/stats/grid` | 中比例尺展示区域网格热力 |
| P0 | 接入 GeoServer WMS | 全球视角展示 `occurrence_grid_monthly` 热力图，必须带 `grid_size` 和 `month` 过滤 |
| P1 | 增加图表面板 | 月度趋势、省级统计、物种排行 |
| P1 | 明确数据解释 tooltip | 记录数/采样密度不等于真实丰度 |
| P2 | 补前端测试 | API client、query store、关键组件冒烟 |

## 已知风险

- 地图仍是占位实现，无法验证 Cesium 绘制、缩放层级切换和图层性能。
- 当前查询结果只在列表展示，没有把点位回绘到地图。
- API 类型由前端手写，后端 schema 变更时需要同步更新。
- 当前色彩和样式集中在 `styles.css`，随着页面增多可能需要拆分组件样式。


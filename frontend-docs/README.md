# BirdScope 前端文档

> 最后更新：2026-06-15

前端位于 `frontend/`，技术栈为 Vite + React 19 + TypeScript + Tailwind CSS + Cesium + ECharts。

## 当前实现

- 查询条件：物种、月份、bbox、多边形、缓冲区
- Cesium 三维主场景和三种空间绘制
- GeoServer WMS 热力图加载
- 后端观测点回绘
- 时间滑块和 8–11 月动画
- 物种排行、月度趋势、区域统计图表
- `ResultList` 组件已存在，但当前页面没有渲染

## 当前联调问题

1. 后端 `/species/search` 返回数组，前端仍按 `{results, total}` 读取，物种搜索需统一契约。
2. WMS 当前使用 `viewparams`，项目契约要求 `CQL_FILTER=grid_size=1.0 AND month=X`。
3. `ResultList` 已导入但未挂回 `MapQueryPage`。

因此“前端可以启动和构建”不代表全部业务已经验收通过。

## 文档导航

- [project_overview.md](project_overview.md)：页面与功能范围
- [architecture.md](architecture.md)：组件和状态流
- [dev_plan.md](dev_plan.md)：本地启动与冒烟
- [api_integration.md](api_integration.md)：接口契约
- [rules_and_conventions.md](rules_and_conventions.md)：开发规范
- [progress.md](progress.md)：当前进度和阻塞项
- [improvement_backlog.md](improvement_backlog.md)：两轮联调反馈的待解决问题、决策与分批实施路线


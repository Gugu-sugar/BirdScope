# BirdScope 前端文档

> 最后更新：2026-06-27

前端位于 `frontend/`，技术栈为 Vite + React 19 + TypeScript + Tailwind CSS + Cesium + ECharts。

## 当前实现

- 查询条件：物种、月份、bbox、多边形、缓冲区
- Cesium 三维主场景和三种空间绘制
- GeoServer WMS 热力图加载
- 后端观测点回绘
- 时间滑块和 8–11 月动画
- 物种排行、月度趋势、区域统计图表
- 结果列表与地图点位双向选中联动
- 左侧图层管理面板：底图切换、点位/网格/WMS 开关、已发布图层列表（含显隐叠加 + 删除，默认层受保护）
- 顶栏发布当前图层弹窗：预聚合·全物种 / 实时聚合·当前物种 双模式
- 联动热力粒度按查询范围面积自适应

## 当前注意事项

1. 发布图层两种语义：预聚合·全物种（现成表 `occurrence_grid_monthly` + `grid_size/year/month` 的 `CQL_FILTER`，不含物种维度）；实时聚合·当前物种（`POST /geoserver/species-grid` 用 SQL View 从 `occurrence_clean` 按物种聚合）。
2. 后续批次仍需优化热力观感和更完整的按相机高度自动分级渲染。
3. Cesium 与 ECharts 体积较大，生产构建会提示 chunk 超过 500 kB。

当前前端可以启动和构建，但仍建议在本地后端、GeoServer 和测试数据库都运行时做完整业务冒烟。

## 文档导航

- [project_overview.md](project_overview.md)：页面与功能范围
- [architecture.md](architecture.md)：组件和状态流
- [dev_plan.md](dev_plan.md)：本地启动与冒烟
- [api_integration.md](api_integration.md)：接口契约
- [rules_and_conventions.md](rules_and_conventions.md)：开发规范
- [progress.md](progress.md)：完成情况与验收自测清单
- [archive/](archive/)：过程性文档归档（分批整合流水、联调反馈 backlog、评审记录）


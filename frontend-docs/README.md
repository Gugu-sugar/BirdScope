# BirdScope 前端文档

> 面向：前端开发、后端联调同学、AI Agent  
> 最后更新：2026-06-14

本目录记录 `frontend/` 当前实现、约定和后续接入点。前端文档结构参考后端文档，但重点放在页面组件、状态流、API 联调和地图接入。

## 文档导航

| 文档 | 内容 | 何时读 |
|------|------|--------|
| [project_overview.md](project_overview.md) | 前端目标、当前范围、页面工作流 | 初次接手前端任务 |
| [architecture.md](architecture.md) | 目录结构、组件分层、数据流 | 修改前端结构前 |
| [dev_plan.md](dev_plan.md) | 环境启动、构建、联调流程 | 本地开发或排查启动问题 |
| [api_integration.md](api_integration.md) | 后端接口封装、请求参数、环境变量 | 改 API 调用或联调后端 |
| [rules_and_conventions.md](rules_and_conventions.md) | UI、数据展示、空间坐标和编码规范 | 每次写前端代码前 |
| [progress.md](progress.md) | 当前实现、缺口和后续优先级 | 接手任务或阶段复盘 |

## 当前结论

- 前端位于 `frontend/`，技术栈为 Vite + React + TypeScript + Tailwind CSS。
- 当前页面是“空间查询工作台”：左侧条件、中央地图占位预览、右侧 GeoJSON 结果列表。
- `QueryProvider` 统一管理查询条件、空间选择、结果、加载和错误状态。
- API 层已封装物种搜索、观测点查询、缓冲区查询、多边形查询和网格查询。
- 地图区域目前是查询范围预览，尚未接入 Cesium 绘制、GeoServer WMS 或统计图表。


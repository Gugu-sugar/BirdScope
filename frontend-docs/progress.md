# BirdScope 前端开发进展

> 最后更新：2026-06-15

## 状态

| 功能 | 状态 | 说明 |
|------|------|------|
| Vite + React + TypeScript + Tailwind | 完成 | 可安装和生产构建 |
| 查询面板和 QueryProvider | 完成 | 三种空间模式已接线 |
| Cesium 主场景 | 已合入待验收 | 初始化、绘制、点位展示已实现 |
| GeoServer WMS | 已合入待修正 | 过滤参数当前不符合 CQL_FILTER 契约 |
| 时间滑块 | 已合入 | 支持 8–11 月播放 |
| ECharts 图表 | 已合入待联调 | 三个图表组件已渲染 |
| ResultList | 组件完成但页面缺失 | `MapQueryPage` 未渲染该组件 |
| `/stats/grid` 区域网格层 | 待做 | 仅有 API 封装 |
| 前端自动化测试 | 待做 | 暂无测试框架和用例 |

## P0 联调阻塞

1. 统一 `/species/search` 响应类型。
2. WMS 改用 `CQL_FILTER`，同时限定 `grid_size` 和 `month`。
3. 决定并恢复 `ResultList` 的页面位置。
4. 明确物种排行和区域统计是否需要物种过滤；若需要，后端接口也要增加参数。
5. 用全量本地数据库跑三种空间查询和图表冒烟。

## P1

- 接入 `/stats/grid` 区域热力层。
- 增加图表 error/empty 状态和请求取消。
- 减少 `MapPanel` 中的 `any` 和 Cesium 私有字段访问。
- 拆分 Cesium/ECharts bundle。

## 数据解释

页面必须持续显示：数据仅覆盖 2024 年 8–11 月；热力和图表表达观测记录/采样密度，不等同真实种群丰度。


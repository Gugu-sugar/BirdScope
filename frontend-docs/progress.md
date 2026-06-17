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
| 图层管理 | 已整合 | 左侧图层面板支持底图切换、矢量点位/热力网格/全球 WMS 开关、已发布图层列表 |
| 发布当前图层 | 已整合 | 顶栏按钮打开发布弹窗，按现成表 `occurrence_grid_monthly` + `grid_size/year/month` 发布 |
| 前端自动化测试 | 待做 | 暂无测试框架和用例 |

## 三批次整合（2026-06-17）

- 批次①：地图点位点击由浏览器 `alert()` 改为页面内气泡；`ResultList` 与地图点位通过 `selectedGbifId` 双向联动。
- 批次②：页面改为地图优先布局，左侧 icon rail + 抽屉面板，右侧常驻上下文卡；删除地图标题栏、示例按钮和页面底栏；新增 Cesium 回正按钮。
- 批次③：图层管理面板接入底图切换、图层显隐、网格粒度、GeoServer 已发布图层列表；顶栏“发布当前图层”接入 `POST /geoserver/layers`。
- 批次④：地图左上增加绘制提示；矩形框选增加橡皮筋预览；多边形右键闭合逻辑修正；删除全屏暗角掩膜。

## 查询联动

- `queryStore.activeQuery` 在执行查询成功时写入 `{speciesKey, speciesName, bbox}`，三种空间模式（bbox/polygon/buffer）统一归一为 bbox。
- 物种与空间范围在快照时固定；月份仍由 `store.month` 实时提供，便于时间滑块播放时图层/图表跟随。
- 图层（`/stats/grid`）与三个图表（rank/monthly/province）均订阅 `activeQuery` + 月份。
- 新查询会清空旧的 `selectedGbifId`，避免列表/地图选中态指向过期点位。

## 后续待做

1. 批次⑤：热力观感和更完整的按相机高度自动分级渲染。
2. 补前端自动化测试，至少覆盖 API client、query store、关键组件冒烟。
3. 评估 Cesium/ECharts 代码分包，降低生产构建大 chunk 提示。

## 数据解释

页面必须持续显示：数据仅覆盖 2024 年 8–11 月；热力和图表表达观测记录/采样密度，不等同真实种群丰度。

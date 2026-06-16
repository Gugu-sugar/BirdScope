# BirdScope 前端开发进展

> 最后更新：2026-06-16

## 状态

| 功能 | 状态 | 说明 |
|------|------|------|
| Vite + React + TypeScript + Tailwind | 完成 | 可安装和生产构建 |
| 查询面板和 QueryProvider | 完成 | 三种空间模式已接线 |
| Cesium 主场景 | 已合入待验收 | 初始化、绘制、点位展示已实现 |
| GeoServer WMS | 已合入待修正 | 过滤参数当前不符合 CQL_FILTER 契约 |
| 时间滑块 | 已合入 | 支持 8–11 月播放 |
| ECharts 图表 | 已联动 | 三图表按 `activeQuery`（物种+范围）+ 实时月份联动，带 AbortController |
| ResultList | 已挂载并联动 | 左侧结果 tab 与地图点位共享选中态 |
| `/stats/grid` 区域网格层 | 已接入（查询联动） | 执行查询后按 bbox+物种+月份拉网格，clampToGround 分级配色；缩放自动切层仍待做 |
| 前端自动化测试 | 待做 | 暂无测试框架和用例 |

## 查询联动（2026-06-16）

- `queryStore` 新增 `activeQuery` 快照：点「执行查询」成功时写入 `{speciesKey, speciesName, bbox}`，三种空间模式（bbox/polygon/buffer）统一归一为 bbox。
- 物种与空间范围在快照时固定；月份仍由 `store.month` 实时提供，便于时间滑块播放时图层/图表跟随。
- 图层（`/stats/grid`）与三个图表（rank/monthly/province）均订阅 `activeQuery` + 月份；后端对应接口已加可选 `bbox` 实时聚合路径（含面积护栏）。
- 所有联动请求带 `AbortController`，新查询发起即取消上一次未完成请求。

## 批次① 逻辑联动（2026-06-16）

- 地图结果点 entity id 固定为 `pt-${gbif_id}`，点击点位不再使用浏览器 `alert()`，改为页面内自定义气泡。
- `queryStore` 新增 `selectedGbifId`，地图点位和 `ResultList` 结果项可双向选中。
- 选中结果项会触发地图 `flyTo` 和点位高亮；地图点选会自动切到结果 tab，并滚动高亮对应行。

## P0 联调阻塞

1. 统一 `/species/search` 响应类型。
2. WMS 改用 `CQL_FILTER`，同时限定 `grid_size` 和 `month`。
3. 明确物种排行和区域统计是否需要物种过滤；若需要，后端接口也要增加参数。
4. 用全量本地数据库跑三种空间查询和图表冒烟。

## P1

- 接入 `/stats/grid` 区域热力层。
- 增加图表 error/empty 状态和请求取消。
- 减少 `MapPanel` 中的 `any` 和 Cesium 私有字段访问。
- 拆分 Cesium/ECharts bundle。

## 数据解释

页面必须持续显示：数据仅覆盖 2024 年 8–11 月；热力和图表表达观测记录/采样密度，不等同真实种群丰度。


# BirdScope 前端完成情况

> 最后更新：2026-06-27
> 状态：**开发完成，可验收**
> 分批次整合流水（批次①–⑤、UI/UX 修复、底图国内化等）见 [archive/frontend_changelog.md](archive/frontend_changelog.md)。

---

## 一、交付概览

前端基于 Vite + React + TypeScript + Tailwind + Cesium + ECharts，实现地图优先的查询工作台：三维地球、分级数据图层、多维查询、统计图表、时空动态时间轴、图层管理与发布。已与后端完成联调，可安装、可生产构建。

| 功能                        | 状态    | 说明                                                                                 |
| --------------------------- | ------- | ------------------------------------------------------------------------------------ |
| 查询面板 + QueryProvider    | ✅      | 物种搜索、月份多选、三种空间模式、缓冲半径、执行查询                                 |
| Cesium 主场景               | ✅      | 初始化、空间绘制提示、橡皮筋预览、点位聚合、回正按钮、`ResizeObserver` 自适应      |
| 全球 WMS 热力               | ✅      | `CQL_FILTER` 随月份 + 网格粒度更新                                                 |
| 区域联动热力`/stats/grid` | ✅      | 按查询范围面积自适应粒度（`lib/adaptiveGrid.ts`）                                  |
| 本地观测点                  | ✅      | GeoJSON 转 Cesium entity，原生聚合                                                   |
| 时空动态时间轴              | ✅      | 原生 range 滑块（8–11 月），播放 / 重置                                             |
| ECharts 图表                | ✅      | 物种排行 / 月度趋势 / 区域统计，按`activeQuery` + 月份联动，带 `AbortController` |
| 结果列表 ResultList         | ✅      | 与地图点位经`selectedGbifId` 双向选中、高亮、滚动定位                              |
| 图层管理面板                | ✅      | 底图切换、点位/联动热力/全球 WMS 显隐、已发布图层显隐叠加 + 删除（默认层受保护）     |
| 发布当前图层弹窗            | ✅      | 双模式：预聚合·全物种 / 实时聚合·当前物种                                          |
| 底图国内化                  | ✅      | 天地图 WMTS（矢量/影像/地形 + 注记），注记盖在热力之上                               |
| 前端自动化测试              | ⏳ 未做 | 当前无测试框架；建议后续补 API client / store / 组件冒烟                             |

详细组件与状态流见 [architecture.md](architecture.md)，接口联调见 [api_integration.md](api_integration.md)。

---

## 二、核心数据流

```text
QueryPanel / MapPanel
    → QueryProvider（activeQuery 快照：物种 + 范围；month 显示月份实时）
    → api/*（client / occurrence / species / stats / geoserver）
    → FastAPI /api/v1
    → Cesium 点位·热力 / ResultList / ECharts
```

- **月份语义拆分**：`queryMonths`（查询表单多选，空 = 全年，仅作用于观测点查询）与 `month`（显示月份，驱动热力图层 + 图表 + 时间轴）相互独立。
- **未选范围默认全球查询**，查询成功后自动隐藏全球 WMS 热力，避免与结果叠加。
- 新查询清空旧 `selectedGbifId`，避免列表/地图选中态指向过期点位。

---

## 三、验收自测清单

后端、GeoServer、数据库就绪后（见根目录 README）：

- [ ] `npm.cmd ci && npm.cmd run dev`，`http://localhost:5173` 正常加载地图
- [ ] 物种搜索有自动补全；选物种 + 框选范围执行查询，地图出点、结果列表与图表联动
- [ ] 时间轴拖动切月份，热力图层与图表随之更新
- [ ] 图层面板可切底图、显隐各图层、查看已发布图层列表
- [ ] 发布弹窗两种模式均可发布，发布层可叠加显示与删除（默认层不可删）
- [ ] `npm.cmd run build` 生产构建通过（Cesium/ECharts 会提示大 chunk，属预期）

---

## 四、已知局限与后续项

1. 缺前端自动化测试。
3. Cesium / ECharts 体积较大，生产构建提示 chunk 超 500 kB，可后续做 `manualChunks` 分包。
4. 开题拓展目标（制图导出、卷帘对比、物种信息卡、LLM 接入）未纳入当前范围。

---

## 五、数据解释（页面必须持续显示）

数据仅覆盖 2024 年 8–11 月；热力和图表表达观测记录 / 采样密度，不等同真实种群丰度。

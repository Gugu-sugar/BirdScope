# BirdScope 后端开发进展

> 最后更新：2026-06-11  
> 面向：全组同学 + AI Agent

---

## 当前状态总览

| 阶段 | 状态 | 完成时间 |
|------|------|----------|
| 目录结构 + 三层架构代码 | ✅ 完成 | 2026-06-05 |
| 数据库建表（3 张表 + 索引）| ✅ 完成 | 2026-06-05 |
| dev_sample.tsv 导入（2000 条全球样本）| ✅ 完成 | 2026-06-05 |
| 全部 API 接口（9 个，occurrence / species / stats / geoserver）| ✅ 完成 | 2026-06-05 |
| FastAPI 服务启动、/docs 可访问 | ✅ 完成 | 2026-06-05 |
| 文档体系建立（docs/ 目录）| ✅ 完成 | 2026-06-06 |
| 第二阶段脚本与环境就绪（DuckDB 安装、build_grid.py 补全、import 提速、样本验证）| ✅ 完成 | 2026-06-11 |
| 全量数据处理（降采样 → TRUNCATE → 全量导入 399.8 万条）| ✅ 完成 | 2026-06-11 |
| 热力聚合表 build_grid.py（1.0° 网格 26,339 单元）| ✅ 完成 | 2026-06-11 |
| GeoServer 图层发布 | ⏳ 待做 | 第三阶段 |
| 前端联调 | ⏳ 待做 | 第四阶段 |
| 核心接口集成测试 | ⏳ 待做 | 第五阶段 |

---

## 已完成详情

### 后端 API（服务地址 http://localhost:8000）

**接口文档（可直接点按钮测试）**：`http://localhost:8000/docs`

当前数据库为**全量降采样数据集**：`occurrence_clean` **3,997,847 条**、`species_lookup` **9,807 个物种**、`occurrence_grid_monthly`（1.0°）**26,339 网格单元**。覆盖六大洲、2024 年 8–11 月。降采样策略见 [data_pipeline.md](data_pipeline.md)，数据质量校验见 [评估报告](assessments/2026-06-11_backend_webgis_data_strategy.md)。

> NULL 边界（已验证保留，未违规填充）：null species/species_key 40,067 条（属级匹配）；null individual_count 196,162 条（约 4.9%）。

**已实现接口清单**：

| 分组 | 接口 | 状态 |
|------|------|------|
| 物种 | `GET /api/v1/species/search` | ✅ |
| 物种 | `GET /api/v1/species/{species_key}` | ✅ |
| 物种 | `GET /api/v1/species/rank` | ✅ |
| 观测点 | `GET /api/v1/occurrence/points` | ✅ |
| 观测点 | `POST /api/v1/occurrence/within` | ✅ |
| 观测点 | `GET /api/v1/occurrence/buffer` | ✅ |
| 统计 | `GET /api/v1/stats/monthly` | ✅ |
| 统计 | `GET /api/v1/stats/province` | ✅ |
| 统计 | `GET /api/v1/stats/grid` | ✅ |
| 统计 | `GET /api/v1/stats/migration` | ✅ |
| GeoServer | `GET /api/v1/geoserver/layers` | ✅ |
| GeoServer | `POST /api/v1/geoserver/layers` | ✅ |
| GeoServer | `DELETE /api/v1/geoserver/layers/{name}` | ✅ |
| GeoServer | `PUT /api/v1/geoserver/layers/{name}/style` | ✅ |

---

## 下一步目标

### ✅ 第二阶段完成（2026-06-11）

- ✅ DuckDB 1.5.3 安装到 devgis 环境
- ✅ 补全 `scripts/build_grid.py`（幂等、支持多网格尺寸）
- ✅ `import_to_pg.py` 由 `executemany`(500) 升级为 `execute_values`(5000)
- ✅ `prepare_global.py` Step 2 别名 bug 修复（外层 `s.` → `t.`）
- ✅ 降采样：全球 309.8 万 + 北美 90.0 万 = 399.8 万条（合计耗时约 2.5 分钟）
- ✅ TRUNCATE → 全量导入 `occurrence_clean` **3,997,847 条**（execute_values，约 7 分钟）
- ✅ `species_lookup` **9,807 物种**、`build_grid` **26,339 网格单元**（1.0°）
- ✅ 导入后校验通过：NULL 边界保留正确、国家分布均衡、空间查询定位正确，见 [评估报告](assessments/2026-06-11_backend_webgis_data_strategy.md)

### ✅ P0 完成（2026-06-11）：/stats/grid 接线预聚合表

- ✅ `query_grid` 拆分路由：无 species_key 且 grid_size∈{1.0,0.5} → 查预聚合表，否则 bbox 收窄实时聚合
- ✅ 补 0.5° 预聚合（63,722 格）+ `(grid_size,year,month)` 复合索引；`build_grid.py` 默认产 1.0/0.5 两档
- ✅ 实测：北美 1725→25ms、欧洲 0.5° 8200→156ms、全球全月 5055→360ms；正确性：全球总数精确一致
- ✅ 两条路径补齐 `center_lon/center_lat`，与 api_reference / AGENT.md 契约对齐
- 边界语义：预聚合返回完整边缘格，与实时裁切差 <1%（详见 api_reference）

### ✅ 接口压测收尾（2026-06-11，400 万行规模）

| 接口 | 耗时 | 评价 |
|------|------|------|
| `/occurrence/points`（bbox limit2000）| 65–70ms | ✅ |
| `/occurrence/points`（全球 limit5000）| 289ms | ✅ |
| `/occurrence/buffer`（50km）| 362ms | ✅ |
| `/stats/grid`（预聚合）| 25–360ms | ✅（P0 已优化）|
| `/stats/migration` | 15ms | ✅ |
| `/species/search` | ~130ms，功能正常（Pass→Passer 等）| ✅ |
| `/stats/monthly` `/province` `/species/rank` | ~1s（冷缓存）| 🟡 见下 |

- 地图关键路径（点/网格/缓冲/搜索）全部达标。
- ⚠️ 测试时本机电池供电（CPU 降频），以上为冷缓存数字，**偏悲观**；插电 + 热缓存下普遍更快。
- monthly/province/rank ~1s：根因为数据全是 2024 年，`year=2024` 选中 100% 行 → 全表 Seq Scan，索引无效（EXPLAIN 确认）。对"图表面板加载一次"可接受。**正解是预聚合表/物化视图（数据使用方案 §C），留作后续优化**；引入多年份数据后 `(year,month)` 索引亦将自然生效。

### 优先级 🟢（留待以后）

1. **图表接口预聚合**：month_counts / species_rank / province_counts 物化视图（解 ~1s）
2. **数据扩容路径 A**：中国多年份（需去重键加 year，见 [扩容评估](assessments/2026-06-11_data_scaling_feasibility.md)）

### 优先级 🟡（第三阶段）

4. **GeoServer 图层发布**
   - Web UI 建 workspace `birdscope` + datastore `birdscope_pg`
   - 调 `POST /api/v1/geoserver/layers` 发布 WMS 图层
   - 配置 SLD 分级配色样式

6. **GeoServer 管控接口加鉴权**（评估报告标记为高风险）
   - 哪怕是硬编码 API Key 也比裸露强

### 优先级 🟢（第四 / 五阶段）

7. **前端联调** — 按前端实际请求格式调整响应
8. **`/stats/grid` 加简单缓存** — 相同参数 30 秒内命中缓存
9. **补充核心接口集成测试**（`/species/search`、`/occurrence/points`）
10. **探索 MVT 替代 WMS**（长期）

---

## 已知技术债

| 问题 | 风险 | 状态 |
|------|------|------|
| GeoServer 管控接口无鉴权 | 高 | ⏳ 待处理（联调前必做）|
| `tests/` 目录为空 | 中 | ⏳ 待补充 |
| `requirements.txt` 未 pin 精确版本 | 低 | ⏳ 可在收尾阶段处理 |
| `occurrence_grid_monthly` 无物种维度 | 中 | ⏳ 长期优化项 |
| ~~`/stats/grid` 实时聚合超标，且为扩容运行瓶颈~~ | 高 | ✅ 已解决（2026-06-11 P0 接线预聚合表，降至毫秒级）|
| ~~`occurrence_grid_monthly` 缺 `(grid_size, year, month)` 复合索引~~ | 中 | ✅ 已解决（2026-06-11）|
| 数据仅覆盖 2024 年 8–11 月，无法做物候/迁徙/年际分析 | 高 | ⏳ 需补春季数据；前端须标注时间窗（见 [空间分析评估](assessments/2026-06-11_spatial_analysis_data_quality.md) P1）|
| `record_count`/`individual_sum` 易被误读为丰度（实为降采样 occupancy 代理）| 高 | ⏳ 前端文案/tooltip 须澄清（P2）|
| 1° 等经纬网格面积随纬度收缩，密度配色高纬虚高 | 中 | ⏳ 全球热力图建议面积归一或等积格网（P3）|

---

## 前端对接快速参考

**坐标格式**：经度在前，纬度在后；bbox = `minx,miny,maxx,maxy`

**缩放级别与数据来源**：

| Cesium 缩放 | 数据来源 |
|------------|---------|
| 全球（< 5）| GeoServer WMS（待配置）|
| 区域（5–9）| `GET /api/v1/stats/grid` |
| 本地（≥ 10）| `GET /api/v1/occurrence/points` |

**注意事项**：
- `species` 可能为 null → 展示 `scientific_name`
- `individual_count` 可能为 null → 展示"数量未知"
- 单次最多返回 2000 个观测点

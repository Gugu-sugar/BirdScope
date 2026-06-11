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

### 优先级 🔴（当前焦点：性能验证与索引）

1. **全量数据下的接口压测**：访问 `/docs` 实测 `/stats/grid`、`/occurrence/points`、`/species/search` 响应时间
   - `/stats/grid?species_key=xxx`（实时聚合）若 > 1s，加 `(species_key, year, month)` 联合索引
   - 确认 GIST / GIN 索引在 400 万行规模下有效
2. **`/stats/grid` 接线预聚合表**：无 `species_key` 时改查 `occurrence_grid_monthly`，兑现 <100ms（评估报告问题 2）
3. **补充 0.5° 网格**：`build_grid.py --grid-size 0.5`

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
| `/stats/grid`（无 species_key）未消费预聚合表，仍实时聚合 | 中 | ⏳ 第三阶段接线（见 [评估报告](assessments/2026-06-11_backend_webgis_data_strategy.md)）|

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

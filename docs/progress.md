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
| 全量数据处理（prepare_global.py → import）| ⏸ 就绪待批 | 第二阶段 |
| 热力聚合表 build_grid.py | ✅ 脚本完成（待全量数据后重建）| 第二阶段 |
| GeoServer 图层发布 | ⏳ 待做 | 第三阶段 |
| 前端联调 | ⏳ 待做 | 第四阶段 |
| 核心接口集成测试 | ⏳ 待做 | 第五阶段 |

---

## 已完成详情

### 后端 API（服务地址 http://localhost:8000）

**接口文档（可直接点按钮测试）**：`http://localhost:8000/docs`

当前数据库有 **2000 条全球样本**，覆盖 10 国、8–11 月四个月份，用于验证接口格式。全量数据导入后替换。

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

### 第二阶段准备成果（2026-06-11 已完成）

- ✅ DuckDB 1.5.3 安装到 devgis 环境（`prepare_global.py` 依赖）
- ✅ 补全缺失的 `scripts/build_grid.py`（幂等、支持多网格尺寸；样本验证：2000 行 → 1,038 网格单元）
- ✅ `import_to_pg.py` 由 `executemany`(500/批) 升级为 `execute_values`(5000/批)，全量导入预计从数小时降至 10-20 分钟
- ✅ 三个脚本均通过 2000 行样本验证
- ⏸ **全量管道执行已就绪，待审批**：见 [human_review.md](human_review.md) [002]。开发者已确认导入前先 TRUNCATE 三张表，但暂未批准开跑。

### 优先级 🔴（第二阶段，待开发者批准后执行）

> 执行前先 TRUNCATE `occurrence_clean` / `species_lookup` / `occurrence_grid_monthly`（已确认）。

1. **运行 `scripts/prepare_global.py`**
   - 流式读取 15GB TSV，按 `(lon/0.1, lat/0.1, species_key, month)` 四元组做空间降采样
   - 输出 `backend/data/global_thinned.tsv`（预计 200–400MB，约 200–400 万条）
   - 估计运行时间 20–40 分钟，内存峰值约 800MB

2. **运行 `import_to_pg.py` 全量导入**
   - 批量写入 `occurrence_clean` + `species_lookup`
   - 使用 `psycopg2.copy_expert`（COPY 协议，比 INSERT 快 10–50 倍）

3. **运行 `build_grid.py` 生成热力聚合表**
   - 生成 `occurrence_grid_monthly`（1 度网格）
   - 后续补充 0.5 度网格

4. **导入后立即测试**：
   - `/stats/grid?species_key=xxx` 响应时间；若 > 1s，加 `(species_key, year, month)` 联合索引

### 优先级 🟡（第三阶段）

5. **GeoServer 图层发布**
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

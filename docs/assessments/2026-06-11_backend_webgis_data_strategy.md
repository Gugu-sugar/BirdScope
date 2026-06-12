# 数据策略评估报告 — 后端 / WebGIS 视角

> 视角：专业后端开发者 + WebGIS 开发者
> 评估对象：第二阶段全量数据管道（prepare_global / prepare_north_america / import_to_pg / build_grid）
> 评估时间：2026-06-11
> 触发：[human_review.md](../human_review.md) [002] 审批意见——"确认各脚本口径一致、方案可行、不影响未来项目功能，若无问题，可执行"

---

## 结论

**三项审批条件均满足，方案可执行。** 发现 1 个非阻塞观察项（见"问题 2"），属第三阶段接线范畴，不影响本次数据导入的正确性与未来功能。

| 审批条件 | 结论 |
|---------|------|
| 各脚本口径一致 | ✅ 通过 |
| 方案可行 | ✅ 通过 |
| 不影响未来项目功能 | ✅ 通过 |

---

## 亮点

1. **列口径完全一致**：`prepare_global.py` 与 `prepare_north_america.py` 使用相同的 20 列 `OUTPUT_COLS`（顺序一致）。全球文件输出含表头，北美文件 `HEADER false`，合并后由 `import_to_pg.py` 的 `csv.DictReader`（按列名解析）正确读取，且 20 列与 `occurrence_clean` schema 一一对应。
2. **网格边界公式对齐**：`build_grid.py` 与运行时 `services/spatial.py::query_grid` 均采用 `floor(coord / gs) * gs` 计算格子边界、`+gs` 计算上界。预聚合表与实时聚合的网格切分完全重合，缩放级别切换时不会出现网格错位。
3. **NULL 语义统一且合规**：两处聚合 `individual_sum` 均用 `SUM(individual_count)`（自动跳过 NULL），未违反"禁止把 NULL 填为 1"的数据规则；全 NULL 时返回 NULL 而非 0。
4. **降采样方法学一致**：两脚本同为"Step1 0.1° 网格去重 + Step2 面积配额/分层随机"两步法；北美额外按 10° 纬度带分层，防高纬稀疏区被全局采样率清空，方法学自洽。
5. **导入提速到位**：`import_to_pg.py` 已由 `executemany(500)` 升级为 `execute_values(5000)`，符合 data_pipeline.md 的 COPY 协议加速目标，500 万行预计 10–20 分钟。

---

## 问题

### 问题 1（低）：global 文件中的非洲/亚洲外国家码处理
`COUNTRY_TO_CONTINENT` 未含北美国家码（US/CA/MX）。若全球 15GB 文件混入少量墨西哥等记录，会被归为 "Unknown" 大洲、采样率 1.0 全部保留。因原始全球文件按来源已排除北美，实际影响极小；保守保留也不破坏全球密度可比性。**无需处理**。

### 问题 2（中，非阻塞，第三阶段接线项）：`/stats/grid` 未消费预聚合表
当前 `query_grid` 始终实时聚合 `occurrence_clean`，**不读取** `occurrence_grid_monthly`。即 `build_grid.py` 的产物目前仅供第三阶段 GeoServer WMS 使用；dev_plan 中"`/stats/grid`（无 species_key）直接查预聚合表，<100ms"的优化尚未接线。

- **对本次导入的影响**：无。数据正确性不受影响。
- **建议（第三阶段）**：当 `species_key` 为空且 `grid_size` 命中预聚合粒度（1.0 / 0.5）时，将 `/stats/grid` 路由到 `occurrence_grid_monthly`，兑现 <100ms 目标。已登记到 progress.md 技术债。

---

## 改进建议（按优先级）

| 优先级 | 项 | 阶段 |
|-------|----|------|
| 🟡 | `/stats/grid` 无 species_key 时改查预聚合表 | 第三阶段 |
| 🟢 | `occurrence_grid_monthly.individual_sum` 关注 INT 上界（全量下单格-月求和理论上限远低于 INT_MAX，当前安全） | 长期观察 |
| 🟢 | `/stats/monthly`、`/stats/migration` 默认 `year=2024`，全量数据若以其他年份为主，需前端显式传 year | 前端联调 |

---

## 执行前置（已与开发者确认）

导入前 **TRUNCATE** `occurrence_clean` / `species_lookup` / `occurrence_grid_monthly`，得到纯净全量集。

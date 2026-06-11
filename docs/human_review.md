# BirdScope 人工审批记录

> 用途：人机协作接口文档。AI Agent 提出变更建议或完成阶段任务后，在此记录待审批项；开发者在"审批意见"栏填写决定。
> AI Agent 在推进涉及以下情形的任务前，**必须检查本文档**：删除文件/数据、发布 GeoServer 图层、修改数据库 schema、变更 API 响应格式。
> 最后更新：2026-06-06

---

## 如何使用

1. AI 完成阶段工作或提出方案后，在"待审批"区新增一条记录（使用下方模板）
2. 开发者在"审批意见"栏填写：**批准 / 拒绝 / 修改后批准**，并可附加说明
3. AI 在下次对话开始时检查本文档，已审批的条目移入"历史记录"区

---

## 待审批

### [002] 运行第二阶段全量数据管道并导入数据库

- **提出时间**：2026-06-11
- **提出方**：AI Agent
- **类型**：数据操作 / 全量导入
- **描述**：
  第二阶段脚本与环境已全部就绪（DuckDB 1.5.3 已装、`build_grid.py` 已补全并通过样本验证、`import_to_pg.py` 已由 executemany 升级为 execute_values 提速）。拟执行完整数据管道：

  1. `prepare_global.py` —— 流式降采样全球 15GB 原始文件 → `data/global_thinned.tsv`（约 30-50 分钟，内存峰值约 6GB，DuckDB 限额）
  2. `prepare_north_america.py` —— 降采样北美 21.8GB 文件 → `data/na_thinned.tsv`（约 30-50 分钟）
  3. PowerShell 合并 na_thinned.tsv 追加至 global_thinned.tsv
  4. **`import_to_pg.py --input data/global_thinned.tsv`** —— 全量写入 `occurrence_clean` + 重建 `species_lookup`（约 500 万条，预计 10-20 分钟）
  5. `build_grid.py` —— 重建 `occurrence_grid_monthly`（1.0 度网格）

  **影响范围**：
  - `occurrence_clean` 当前 2000 条样本将被全量数据覆盖性扩充（导入用 `ON CONFLICT (gbif_id) DO NOTHING`，样本中真实 gbif_id 会保留，不会重复）。如需纯净全量集，可先 TRUNCATE 三张表——**此 TRUNCATE 决定需开发者明确指示**。
  - 整个过程约 2-3 小时，期间占用本机 CPU/内存/磁盘（输出文件约 300-410MB + 北美约 90 万条）。
  - 不变更任何 schema、不变更 API 响应格式。
- **参考文档**：[data_pipeline.md](data_pipeline.md)、[dev_plan.md](dev_plan.md)

**审批意见**：
> （2026-06-11 开发者初步意见）**暂不执行全量管道**，本轮仅完成脚本与环境准备。
> 已确认：将来执行导入时，**先 TRUNCATE 清空 occurrence_clean / species_lookup / occurrence_grid_monthly 三张表**，得到纯净全量集。
> 待开发者明确批准后，Agent 再按 [002] 步骤 1-5 执行。
（审批后意见）以专业后端开发者、WebGIS开发者视角评估当前数据策略，确认各脚本口径一致、方案可行、不影响未来项目功能，若无问题，可执行
---

## 新增待审批条目模板

```
### [编号] [简短标题]

- **提出时间**：YYYY-MM-DD
- **提出方**：AI Agent / 开发者姓名
- **类型**：文件变更 / Schema 变更 / API 变更 / 数据操作 / 其他
- **描述**：
  （详细说明提议的变更内容、理由、影响范围）
- **参考文档**：（相关的 docs/ 文件链接）

**审批意见**：
> *(待填写)*
```

---

## 历史记录

### [001] 删除 test_data 中的三个旧文件

- **提出时间**：2026-06-06
- **提出方**：AI Agent
- **类型**：文件变更
- **描述**：
  建议删除以下三个文件，原因已在对话中分析：

  - `backend/test_data/cn_sample_records.tsv`（500行旧版样本，10列，已被2000行全球样本取代，AGENT.md 明确标注 legacy）
  - `backend/test_data/sample_summary.json`（早期数据探索脚本的输出，与 cn_sample_records.tsv 配套，探索阶段已完成）
  - `backend/test_data/数据概况.md`（早期数据探索记录，关键信息已被 AGENT.md 吸收）

  保留：`dev_sample.tsv`、`dev_sample_info.md`（移入 docs/）
- **参考文档**：[data_pipeline.md](data_pipeline.md)

**审批意见**：

> 批准

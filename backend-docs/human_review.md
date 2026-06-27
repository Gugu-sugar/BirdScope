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

> *(目前无待审批项)*

---

## 新增待审批条目模板

```
### [编号] [简短标题]

- **提出时间**：YYYY-MM-DD
- **提出方**：AI Agent / 开发者姓名
- **类型**：文件变更 / Schema 变更 / API 变更 / 数据操作 / 其他
- **描述**：
  （详细说明提议的变更内容、理由、影响范围）
- **参考文档**：（相关的 backend-docs/ 文件链接）

**审批意见**：
> *(待填写)*
```

---

## 历史记录

### [006] 新增按物种实时聚合发布 GeoServer 图层（POST /geoserver/species-grid）

- **提出时间**：2026-06-17
- **提出方**：AI Agent（开发者直接要求"完成图层发布、按物种"并指定方案 B）
- **类型**：API 变更（纯新增端点）/ GeoServer 图层发布
- **描述**：预聚合表 `occurrence_grid_monthly` 不含物种维度，原发布弹窗选了物种也只能发全物种热力。新增 `POST /geoserver/species-grid`：用 GeoServer SQL View 虚拟表从 `occurrence_clean` 按 `species_key (+month) + year` 实时聚合，按 `grid_size` `floor`→`ST_MakeEnvelope` 还原多边形格 + `COUNT(*)`，输出与预聚合表同构（`Polygon + record_count`），复用 `grid_heatmap` 样式。代码纯新增：`services/geoserver.py` 加 `_species_grid_payload`/`publish_species_grid_layer`（数值参数白名单校验：grid_size∈{1,0.5,0.25,0.1}、month 1–12、species_key 正整数，f-string 插值无注入面）；`routers/geoserver.py` 加 `SpeciesGridRequest` + 端点（写操作沿用 `X-API-Key`）。前端 `PublishLayerDialog` 加"数据源"双模式切换，选了物种默认实时聚合。另修一个前端真实 bug：`api/client.ts` 对象展开顺序颠倒导致带 `X-API-Key` 的 POST 丢失 `Content-Type` → FastAPI 判 422。
- **验证**：✅ 已实测。发布 `species_key=2486131`(Pycnonotus cafer) 10 月 1.0° 图层，WMS GetMap 返回合法 PNG，网格集中在印度次大陆（与该种分布吻合）；WFS 计数与 `GET /stats/grid?species_key=2486131&month=10` 同源逐项对齐（348 格、record_count 合计 2739）；全年(month 缺省)路径合计 10515，等于该种总记录数。delete 路径对虚拟表同样有效，4 个测试图层已清理，GeoServer 仅余基础层 `occurrence_grid_monthly`。前后端 `npm run build` / 接口测试均通过。
- **参考文档**：[api_reference.md](api_reference.md)（GeoServer 节）、[database_design.md](database_design.md)、[../frontend-docs/api_integration.md](../frontend-docs/api_integration.md)
- **补充（同日，纯前端）**：图层面板补齐已发布图层的「显隐切换 + 删除」交互——显隐为前端 WMS 叠加（`store.displayedLayers`），删除调用 [004] 已批准的 `DELETE /geoserver/layers/{name}`（无新增后端）；默认层 `occurrence_grid_monthly` 受保护不可删。

**审批意见**：

> *(待开发者确认；发布/删除均为 GeoServer 侧幂等可回滚操作，不改 PostGIS 数据)*

### [005] 重新导出全量数据库 dump（新增 occurrence_stats_monthly 预聚合表）

- **提出时间**：2026-06-16
- **提出方**：AI Agent（开发者直接要求"更新 deploy 文件夹"）
- **类型**：数据操作（只读导出）/ 文件覆盖
- **描述**：开发者反馈"改了数据库"，核查发现 `occurrence_stats_monthly` 表（图表预聚合，第 0edb17c 次提交新增，775,726 条）不在旧 dump 中；其余三表（`occurrence_clean` 3,997,847、`species_lookup` 9,807、`occurrence_grid_monthly` 90,061）行数与旧 dump 一致未变。`pg_dump -Fc` 只读全量导出覆盖 `deploy/dump/birdscope.dump`（307MB→327MB，不动现有数据库），同步更新 `deploy/README.md` 和 `deploy/dump/README.md` 的数据量说明。
- **验证**：`pg_restore --list` 确认新 dump 含全部 5 张表的 TABLE DATA 段（含 occurrence_stats_monthly），未做实际 restore 测试。
- **补充**：开发者要求"补上所有文档"后，已在 [database_design.md](database_design.md) 补齐 `occurrence_stats_monthly` 表结构、索引与聚合 SQL 说明；`data_pipeline.md`、`progress.md`、`api_reference.md`、`frontend-docs/` 此前两次提交（0edb17c、cfe6651）已同步更新，核查未发现遗漏。

**审批意见**：

> *(待开发者确认；导出为只读操作、不改动现有数据库，dump 可重新生成)*

### [004] 发布 GeoServer 图层 occurrence_grid_monthly（第三阶段）

- **提出时间**：2026-06-14
- **提出方**：AI Agent
- **类型**：GeoServer 图层发布 / 文件新增
- **描述**：第三阶段图层发布。代码（纯新增）：管控接口加 `X-API-Key` 鉴权（config/deps/router）；`styles/grid_heatmap.sld` 7 级 YlOrRd 分色；`services/geoserver.py` 新增 ensure_workspace/datastore + create_or_update_style + layer_exists；`scripts/setup_geoserver.py` 一键发布。实际写操作仅在 GeoServer 侧建 workspace/datastore/style 并发布图层，不改 PostGIS 数据，幂等可回滚。
- **验证**：开发者批准（"没问题"）+ 聊天确认发布后执行。`setup_geoserver.py` 四步全 created；WMS GetMap（全球 10 月 1.0°，CQL_FILTER=grid_size=1.0 AND month=10）返回合法 PNG，YlOrRd 分级渲染正确、热点分布与 eBird 吻合。修复一个真实 bug：发布 featuretype 时 payload 的 defaultStyle 被忽略 → 显式补 set_layer_style 绑定 `birdscope:grid_heatmap`。鉴权经 TestClient 验证（无/错 key→401，正确 key 通过，GET 开放）。另：重启了一个长时间运行后假死的 GeoServer Windows 服务。

**审批意见**：

> 没问题（开发者批准，并在对话中二次确认"确认发布"）

### [003] 导出全量数据库 dump 并新增 Docker 一键交付包（deploy/）

- **提出时间**：2026-06-12
- **提出方**：AI Agent
- **类型**：数据操作（只读导出）/ 文件新增
- **描述**：为前端同学本地联调，`pg_dump -Fc` 只读导出 `birdscope` 全量库到 `deploy/dump/birdscope.dump`（1.6GB→307MB，不动现有库）；新增 `deploy/` 一键起包（Dockerfile + docker-compose：PostGIS 18-3.6 自动恢复数据 + FastAPI，不含 GeoServer）+ 零基础 README。dump 与 .env 不入 git。
- **验证**：全新环境 `down -v && up` 实测通过——自动恢复 occurrence_clean 3,997,847 / species_lookup 9,807 / grid 90,061，`/health`、`/species/search`、`/stats/grid` 均正常返回。修复了一个 PG18 数据卷需挂 `/var/lib/postgresql`（非 `/data`）的真实 bug。

**审批意见**：

> 导出为只读操作、不改动现有数据库，且交付包为纯新增文件，已执行并通过验证。如需回溯，dump 可重新生成。

### [002] 运行第二阶段全量数据管道并导入数据库

- **提出时间**：2026-06-11
- **提出方**：AI Agent
- **类型**：数据操作 / 全量导入
- **描述**：降采样全球 15GB + 北美 21.8GB 原始数据 → TRUNCATE 三表 → 全量导入 `occurrence_clean` + 重建 `species_lookup` + `build_grid`。

**审批意见**：

> 开发者：先 TRUNCATE 清空再导入；以后端/WebGIS 视角评估数据策略，确认口径一致、方案可行、不影响未来功能后可执行。
> Agent：已出具 [评估报告](archive/2026-06-11_backend_webgis_data_strategy.md)，三项条件通过。**已执行完成**——降采样 399.8 万条，导入 `occurrence_clean` 3,997,847 条、`species_lookup` 9,807 物种、`occurrence_grid_monthly`(1.0°) 26,339 单元，导入后校验通过。

### [001] 删除 test_data 中的三个旧文件

- **提出时间**：2026-06-06
- **提出方**：AI Agent
- **类型**：文件变更
- **描述**：
  建议删除以下三个文件，原因已在对话中分析：

  - `backend/test_data/cn_sample_records.tsv`（500行旧版样本，10列，已被2000行全球样本取代，AGENT.md 明确标注 legacy）
  - `backend/test_data/sample_summary.json`（早期数据探索脚本的输出，与 cn_sample_records.tsv 配套，探索阶段已完成）
  - `backend/test_data/数据概况.md`（早期数据探索记录，关键信息已被 AGENT.md 吸收）

  保留：`dev_sample.tsv`、`dev_sample_info.md`（移入 backend-docs/）
- **参考文档**：[data_pipeline.md](data_pipeline.md)

**审批意见**：

> 批准

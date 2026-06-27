# BirdScope 后端完成情况

> 最后更新：2026-06-27
> 状态：**开发完成，可验收**
> 逐阶段开发流水见 [archive/backend_changelog.md](archive/backend_changelog.md)；人工审批历史见 [human_review.md](human_review.md)。

---

## 一、交付概览

后端基于 FastAPI + SQLAlchemy + PostGIS，对外提供 `/api/v1` 业务查询、统计、GeoServer 管控接口，并通过脚本完成数据清洗、降采样、入库与预聚合。所有规划接口均已实现、自测通过，并与前端完成联调。

| 模块 | 状态 |
|------|------|
| 三层架构（routers / services / models·schemas）| ✅ 完成 |
| 数据管道（降采样 → 导入 → 网格预聚合 → 图表事实表）| ✅ 完成 |
| 全量数据入库（约 399.8 万条观测）| ✅ 完成 |
| 全部 API 接口（物种 / 观测点 / 统计 / GeoServer）| ✅ 完成 |
| GeoServer 图层发布 + 管控接口 `X-API-Key` 鉴权 | ✅ 完成 |
| 接口性能优化（预聚合表 + 图表事实表）| ✅ 完成 |
| 前后端完整联调 | ✅ 完成 |
| 数据库快照交付（`deploy/dump/birdscope.dump`）| ✅ 完成 |

---

## 二、数据规模

| 表 | 行数 | 说明 |
|----|------|------|
| `occurrence_clean` | 3,997,847 | 全量降采样明细点，覆盖六大洲，2024 年 8–11 月 |
| `species_lookup` | 9,807 | 物种索引（搜索 / 自动补全）|
| `occurrence_grid_monthly` | ~90,061 | 预聚合热力网格（1.0° 约 26,339 + 0.5° 约 63,722）|
| `occurrence_stats_monthly` | 775,726 | 图表月度事实表（monthly / province / migration / rank 上卷）|

NULL 边界已按规则保留，未违规填充：null species/species_key 40,067 条（属级匹配）；null individual_count 196,162 条（约 4.9%）。详见 [database_design.md](database_design.md)、[data_pipeline.md](data_pipeline.md)。

---

## 三、API 接口清单（全部 ✅）

接口契约与示例见 [api_reference.md](api_reference.md)；运行后可在 `http://localhost:8000/docs` 直接测试。

| 分组 | 接口 |
|------|------|
| 物种 | `GET /species/search`、`GET /species/{species_key}`、`GET /species/rank` |
| 观测点 | `GET /occurrence/points`、`POST /occurrence/within`、`GET /occurrence/buffer` |
| 统计 | `GET /stats/monthly`、`GET /stats/province`、`GET /stats/grid`、`GET /stats/migration` |
| GeoServer | `GET /geoserver/layers`、`POST /geoserver/layers`、`POST /geoserver/species-grid`、`DELETE /geoserver/layers/{name}`、`PUT /geoserver/layers/{name}/style` |

写操作（POST/DELETE/PUT）需 `X-API-Key`，GET 开放。

---

## 四、关键性能（400 万行规模，冷缓存）

| 接口 | 耗时 | 说明 |
|------|------|------|
| `/occurrence/points`（bbox limit2000）| 65–70ms | 大范围走 `TABLESAMPLE` 自适应采样 |
| `/occurrence/buffer`（50km）| ~360ms | 球面精确 |
| `/stats/grid`（预聚合）| 25–360ms | 预聚合表接线 |
| `/stats/migration`（单种）| ~10ms | 走事实表 |
| `/stats/monthly` `/province` `/species/rank` | ~10–130ms | 走事实表 |
| `/species/search` | ~130ms | GIN 全文索引 |

---

## 五、验收自测清单

数据库恢复后，按 [dev_plan.md](dev_plan.md) 启动，可逐项验证：

- [ ] `pg_restore` 后四张表行数与上表一致
- [ ] `http://localhost:8000/health` 返回 ok
- [ ] `http://localhost:8000/docs` 可打开并逐接口测试
- [ ] `python scripts/setup_geoserver.py` 幂等发布 `birdscope:occurrence_grid_monthly`
- [ ] WMS GetMap（全球 10 月 1.0°，`CQL_FILTER=grid_size=1.0 AND month=10`）返回合法 PNG
- [ ] `python -m unittest discover -s tests`（health / OpenAPI / GeoServer 鉴权 + 图表情景测试）通过（图表测试需连真实 DB，否则自动 skip）

---

## 六、已知局限与长期项

| 项 | 说明 |
|----|------|
| 数据仅覆盖 2024 年 8–11 月 | 无法做年际 / 完整物候分析；前端已标注时间窗 |
| `record_count` / `individual_sum` 非真实丰度 | 系降采样后的采样密度代理；前端文案已澄清 |
| `occurrence_grid_monthly` 无物种维度 | 物种热力走 `/stats/grid` 实时聚合或 `/geoserver/species-grid` 虚拟表；长期可补物种维度预计算 |
| 等经纬网格高纬面积收缩 | 全球热力高纬密度略虚高；长期可改等积格网 |
| `requirements.txt` 未 pin 精确版本 | 收尾项 |
| `/occurrence/*`、`/species/search` 缺端到端集成测试 | 图表接口已有真实 DB 情景测试，其余待补 |

# eBird 数据清洗与 PostGIS / GeoServer 工作笔记

> 历史交接记录。全量数据导入、预聚合、数据库 dump 和 GeoServer 发布已经完成。当前运行步骤以根目录 `README.md`、`backend-docs/dev_plan.md` 和 `frontend-docs/progress.md` 为准，不要把本文末尾的“立即可执行下一步”当作当前待办。

## 1. 本次仓库审核结论

已阅读并确认以下关键文件：
- `BirdScope_Git协作指南.md`：仓库协作流程、分支与 PR 规范
- `BirdScope_后端开发方案.md`：后端数据管道、数据库建表、GeoServer 发布流程说明
- `docs/data_pipeline.md`：完整的数据清洗、降采样、导入与预聚合流程
- `BirdScope_数据使用方案.md`：清洗层、PostGIS 表设计、GeoServer / FastAPI / 前端分工
- `backend/scripts/prepare_global.py`：全球 eBird 数据降采样脚本
- `backend/scripts/prepare_north_america.py`：北美数据降采样脚本
- `backend/scripts/import_to_pg.py`：TSV 导入 `occurrence_clean` 与 `species_lookup`
- `backend/scripts/build_grid.py`：生成 `occurrence_grid_monthly` 预聚合热力网格
- `backend/scripts/setup_geoserver.py`：一键发布 GeoServer 图层与样式
- `backend/scripts/init_db.sql`：PostGIS 数据库与索引 DDL
- `backend/app/config.py`：GeoServer 与数据库配置、API key 协议
- `backend/app/services/geoserver.py`：GeoServer REST 客户端实现

## 2. 当前可落地模块

### 数据清洗与降采样
- `prepare_global.py` 实现非北美 0.1° 网格去重 + 大洲面积配额子采样
- `prepare_north_america.py` 实现北美 0.1° 网格去重 + 纬度带分层采样
- `docs/data_pipeline.md` 明确了两步策略与输入/输出格式要求

### PostGIS 导入与建库
- `backend/scripts/import_to_pg.py` 支持批量写入 `occurrence_clean`
- `backend/scripts/init_db.sql` 已包含 PostGIS 扩展、表结构、推荐索引
- `backend/scripts/build_grid.py` 生成 1.0° 与 0.5° 热力网格

### GeoServer 发布与管理
- `setup_geoserver.py` 提供 workspace/datastore/style/layer 的自动化发布
- `app/services/geoserver.py` 已封装 GeoServer 2.28 REST 操作
- `config.py` 支持 `GEOSERVER_API_KEY`，后端可对管控接口加鉴权

## 3. 已识别的问题与注意点

- `prepare_global.py` 和 `prepare_north_america.py` 依赖本地原始文件路径，需确认 `D:/EBIRD/...` 是否有效
- `import_to_pg.py` 默认导入 `backend/test_data/dev_sample.tsv`，全量导入需手动指定 `--input`
- `setup_geoserver.py` 需要 GeoServer 已启动且 `.env` 中配置正确
- `backend/scripts/build_grid.py` 目前默认生成 `1.0` 和 `0.5` 度网格，若需要 `0.1` 度应补充参数
- `backend/scripts/init_db.sql` 已包含复合索引，但 `occurrence_clean` 上可能还需要更多复合索引以优化高频查询

## 4. 立即可执行的下一步工作

1. 在本地创建数据文件目录 `backend/data/` 并运行降采样脚本
2. 生成 `backend/data/global_thinned.tsv` 和 `backend/data/na_thinned.tsv`
3. 运行 `python scripts/import_to_pg.py --input backend/data/global_thinned.tsv` 导入 PostGIS
4. 运行 `python scripts/build_grid.py --grid-size 1.0 --grid-size 0.5` 生成预聚合网格
5. 运行 `python scripts/setup_geoserver.py` 发布 GeoServer 图层
6. 将当前工作进度用 PR 流程同步给组员

## 5. 本次提交说明

- 已在新分支记录仓库审查结果和接下来的实施计划
- 这是后续数据清洗、降采样、PostGIS 导入与 GeoServer 发布工作的起点

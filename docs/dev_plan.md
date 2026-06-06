# BirdScope 后端开发方案

> 来源整合：BirdScope_后端开发方案.md（第三、七、八、九、十节）  
> 版本：v1.2 | 最后更新：2026-06-06

---

## 环境配置

### Python 环境

使用 `D:\conda_env\conda_envs\devgis\python.exe`。

系统默认 `python` 是 ArcGIS Pro 环境，**没有所需依赖，不可用**。

### 依赖安装

```
fastapi>=0.111
uvicorn[standard]
sqlalchemy>=2.0
psycopg2-binary
python-dotenv
pydantic-settings
requests
shapely
pandas
```

`geopandas` 仅 `build_grid.py` 脚本用到，API 运行时不需要。

### .env 关键变量

```ini
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=birdscope
DB_USER=postgres
DB_PASSWORD=yourpassword

# GeoServer 2.28.1（本机端口 8080）
GEOSERVER_URL=http://localhost:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASSWORD=geoserver
GEOSERVER_WORKSPACE=birdscope
GEOSERVER_DATASTORE=birdscope_pg

# 原始数据路径
RAW_DATA_PATH=D:/EBIRD/0009321-260519110011954.csv

# FastAPI
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=true
```

永远通过 `from app.config import settings` 读取配置，不要直接用 `os.environ`。

### 启动服务

```powershell
# 方式一：PowerShell
$env:PYTHONPATH=""
Set-Location "C:\Users\25316\Desktop\开发\大程\backend"
D:\conda_env\conda_envs\devgis\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

访问 `http://localhost:8000/docs` 查看 Swagger UI。

**注意**：本机代理设置为 `127.0.0.1:7897`。curl 测试用 `--noproxy localhost`；Python 测试先 `del os.environ['http_proxy']`；浏览器访问前确认 localhost 已直连。

### 数据库初始化（已完成，记录备用）

```sql
CREATE DATABASE birdscope;
\c birdscope
CREATE EXTENSION IF NOT EXISTS postgis;
```

运行 `psql -d birdscope -f scripts/init_db.sql` 建表（幂等，可重复执行）。

### GeoServer 手动前置步骤（一次性）

1. 登录 `http://localhost:8080/geoserver`
2. 新建工作空间：名称 `birdscope`，命名空间 URI `http://birdscope.local`
3. 新建数据存储：类型选 PostGIS，名称 `birdscope_pg`，连接参数填 birdscope 数据库信息

后续图层发布通过 `POST /api/v1/geoserver/layers` 自动完成。

---

## 开发时间线

### ✅ 第一阶段（已完成）：框架 + 表结构 + 全量接口

- 数据库建表、PostGIS 扩展、3 张表 + 索引
- `config / db / deps / models / schemas / services / routers / main.py` 全部完成
- `dev_sample.tsv`（2000 条全球样本）导入成功
- FastAPI 服务启动，9 个接口全部验证通过

### 第二阶段：全量数据处理

1. 编写 `scripts/prepare_global.py`（参考 [data_pipeline.md](data_pipeline.md) 降采样策略）
2. 运行：约 30–40 分钟，输出 `backend/data/global_thinned.tsv`（预计 200–400MB）
3. 运行 `import_to_pg.py`（约 20 分钟）
4. 运行 `build_grid.py` 生成热力聚合表

### 第三阶段：GeoServer 图层发布

1. GeoServer Web UI 建 workspace + datastore（见上方前置步骤）
2. `POST /api/v1/geoserver/layers` 发布 `occurrence_grid_monthly` 为 WMS 图层
3. 配置 SLD 分级配色样式
4. 前端测试 WMS 加载

### 第四阶段：前端联调

- 根据前端实际请求调整响应格式
- 压测 `/stats/grid` 和 `/occurrence/points`（目标 < 500ms）
- 处理 CORS 或格式问题

### 第五阶段：收尾

- 补充 `build_grid.py`（0.5 度聚合层）
- 补充核心接口集成测试
- 写 README 启动说明
- 备份数据库

---

## 性能预期与优化方向

| 接口 | 预期响应时间 | 优化手段 |
|------|-------------|----------|
| `/species/search` | < 50ms | GIN 全文索引 |
| `/occurrence/points`（bbox） | < 200ms | GIST 索引 + limit 2000 |
| `/stats/grid`（无 species_key） | < 100ms | 直接查预聚合表 |
| `/stats/grid`（有 species_key） | 200–500ms | 实时 ST_SnapToGrid，bbox 限制范围 |
| `/stats/monthly` | < 100ms | (year, month) 联合索引 |
| WMS 全球热力图 | < 1s（GeoServer 缓存后）| GeoServer tile cache |

如 `/stats/grid?species_key=xxx` 响应超 1s，加 `(species_key, year, month)` 联合 B-tree 索引。

---

## 已知坑预警

| 问题 | 原因 | 解决 |
|------|------|------|
| TSV 读出乱码 | 文件是 UTF-8，Windows 默认 GBK | `open(..., encoding='utf-8')` |
| `species` 字段为空 | 记录只匹配到属级 | fallback 到 `scientific_name` |
| `individualCount` 为 NULL | 约 6% 记录缺失 | 热力图按记录数，数量图注明缺失 |
| PostGIS 坐标系报错 | 插入 geometry 未指定 SRID | `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` |
| GeoServer 发布失败 | datastore `birdscope_pg` 未建 | 先在 Web UI 手动建一次 |
| CORS 报错 | FastAPI 未配 CORS | `main.py` 加 `CORSMiddleware(allow_origins=["*"])` |
| `prepare_global.py` 内存溢出 | seen 字典过大（峰值约 800MB）| 改为按月份分批处理 |
| GeoServer 2.28 REST 路径变化 | 新版端点略有调整 | 参考官方 `/geoserver/rest` Swagger UI |

---

## Docker 环境（给组员用）

```yaml
# docker-compose.yml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: birdscope
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init_db.sql:/docker-entrypoint-initdb.d/init.sql

  geoserver:
    image: kartoza/geoserver:2.28.0
    ports:
      - "8080:8080"
    environment:
      GEOSERVER_ADMIN_USER: admin
      GEOSERVER_ADMIN_PASSWORD: geoserver

volumes:
  pgdata:
```

组员使用：
```bash
docker-compose up -d
cp .env.example .env  # 填写密码
pip install -r requirements.txt
uvicorn app.main:app --reload
```

本机有本地 PG+GeoServer 安装，跳过 docker-compose 直接修改 `.env` 即可。

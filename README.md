# BirdScope

BirdScope 是基于 GBIF/eBird 鸟类观测数据的三维地图查询与可视化项目。

当前推荐使用**本地原生方式**运行：PostgreSQL/PostGIS、FastAPI、GeoServer 和前端分别在本机启动。`deploy/dump/birdscope.dump` 已包含约 399.8 万条观测记录。

## 服务组成

| 服务 | 默认地址 | 用途 |
|------|----------|------|
| PostgreSQL + PostGIS | `localhost:5432` | 存储观测点、物种索引和预聚合网格 |
| FastAPI | `http://localhost:8000` | 查询、统计和 GeoServer 管控 API |
| GeoServer | `http://localhost:8080/geoserver` | 全球 WMS 热力图 |
| Vite 前端 | `http://localhost:5173` | React + Cesium + ECharts 页面 |

## 一、本地数据库

数据库快照由 PostgreSQL 18.4 导出。建议安装 PostgreSQL 18 和对应 PostGIS 3.6，并将 PostgreSQL 18 的 `bin` 目录加入 PATH。

确认版本：

```powershell
psql --version
pg_restore --version
```

创建空库并恢复数据：

```powershell
$env:PGPASSWORD="你的 postgres 密码"
createdb -h localhost -U postgres birdscope
pg_restore -h localhost -U postgres -d birdscope `
  --no-owner --no-privileges `
  deploy/dump/birdscope.dump
```

验证数据：

```powershell
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM occurrence_clean;"
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM species_lookup;"
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM occurrence_grid_monthly;"
```

预期分别约为 `3,997,847`、`9,807`、`90,061`。

## 二、后端

项目当前开发环境位于 `E:\Anaconda3\envs\devgis\python.exe`。第一次运行先创建配置：

```powershell
Copy-Item backend\.env.example backend\.env
```

编辑 `backend/.env`，至少填写数据库密码：

```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=birdscope
DB_USER=postgres
DB_PASSWORD=你的 postgres 密码
APP_DEBUG=true
```

安装依赖并启动：

```powershell
cd backend
E:\Anaconda3\envs\devgis\python.exe -m pip install -r requirements.txt
E:\Anaconda3\envs\devgis\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

验证：

- `http://localhost:8000/health`
- `http://localhost:8000/docs`

## 三、GeoServer

确认 GeoServer 2.28.1 已启动并可访问 `http://localhost:8080/geoserver/web/`，然后在 `backend/` 目录执行：

```powershell
E:\Anaconda3\envs\devgis\python.exe scripts/setup_geoserver.py
```

脚本会创建 `birdscope` workspace、`birdscope_pg` datastore、上传热力样式并发布 `birdscope:occurrence_grid_monthly`。

## 四、前端

另开一个 PowerShell：

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

默认 API 地址已经是 `http://localhost:8000/api/v1`。如需覆盖，复制 `frontend/.env.example` 为 `frontend/.env.local`。

浏览器访问 `http://localhost:5173`。

## 五、启动顺序

```text
PostgreSQL/PostGIS
    -> FastAPI
    -> GeoServer 图层初始化/检查
    -> Vite 前端
```

详细说明：

- 项目约定：[AGENT.md](AGENT.md)
- 本地后端：[backend-docs/dev_plan.md](backend-docs/dev_plan.md)
- 前端联调：[frontend-docs/dev_plan.md](frontend-docs/dev_plan.md)
- 数据快照：[deploy/README.md](deploy/README.md)

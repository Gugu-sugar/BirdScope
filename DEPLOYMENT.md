# BirdScope 部署说明

> 环境要求、依赖清单与本地部署步骤。项目简介见 [README.md](README.md)；开发流程见 [AGENT.md](AGENT.md)。
> 最后更新：2026-06-27

当前推荐使用**本地原生方式**运行：PostgreSQL/PostGIS、FastAPI、GeoServer、前端分别在本机启动，不依赖 Docker（Docker 仅作可选交付方式，见文末）。

---

## 一、环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| 操作系统 | Windows 10/11 | 项目在 Windows + PowerShell 下开发；Linux/macOS 需自行调整命令 |
| PostgreSQL | **18** | 数据库快照由 PostgreSQL 18.4 导出，建议同版本恢复 |
| PostGIS | **3.6** | 须与 PostgreSQL 18 对应 |
| GeoServer | **2.28.1** | 提供全球热力 WMS/WFS |
| Python | **3.11+** | 解释器路径写入 `backend/.env` 的 `PYTHON_PATH` |
| Node.js | **18+（建议 20 LTS）** | 前端使用 Vite 7，需较新 Node |
| Java | JDK 11/17 | GeoServer 2.28 运行所需（随 GeoServer 安装包） |

服务默认地址：

| 服务 | 默认地址 | 用途 |
|------|----------|------|
| PostgreSQL + PostGIS | `localhost:5432` | 存储观测点、物种索引、预聚合网格与图表事实表 |
| FastAPI | `http://localhost:8000` | 查询、统计、GeoServer 管控 API |
| GeoServer | `http://localhost:8080/geoserver` | 全球 WMS 热力图 |
| Vite 前端 | `http://localhost:5173` | React + Cesium + ECharts 页面 |

---

## 二、依赖清单

### 后端 Python（`backend/requirements.txt`）

| 依赖 | 用途 |
|------|------|
| `fastapi` / `uvicorn[standard]` | Web 框架与 ASGI 服务器 |
| `sqlalchemy` (2.x) / `geoalchemy2` | ORM 与 PostGIS 几何类型支持 |
| `psycopg2-binary` | PostgreSQL 驱动 |
| `pydantic-settings` / `python-dotenv` | 配置与 `.env` 读取 |
| `shapely` | 几何处理 |
| `requests` | 调用 GeoServer REST |
| `pandas` / `duckdb` | 数据降采样与管道脚本 |
| `httpx` | 测试用（`TestClient`）|

### 前端 Node（`frontend/package.json`）

| 依赖 | 用途 |
|------|------|
| `react` / `react-dom` (19) | UI 框架 |
| `vite` (7) / `@vitejs/plugin-react` / `vite-plugin-cesium` | 构建与 Cesium 集成 |
| `cesium` (1.142) | 三维地球 |
| `echarts` / `echarts-for-react` | 统计图表 |
| `lucide-react` | 图标 |
| `typescript` (5.6) | 类型系统 |
| `tailwindcss` / `postcss` / `autoprefixer` | 样式 |

---

## 三、部署步骤

### 1. 恢复数据库

数据库快照由 PostgreSQL 18.4 导出。安装 PostgreSQL 18 + PostGIS 3.6，并把 PostgreSQL 18 的 `bin` 目录加入 PATH。

确认版本：

```powershell
psql --version
pg_restore --version
```

创建空库并恢复数据（在仓库根目录执行）：

```powershell
$env:PGPASSWORD="你的 postgres 密码"
createdb -h localhost -U postgres birdscope
pg_restore -h localhost -U postgres -d birdscope `
  --no-owner --no-privileges `
  deploy/dump/birdscope.dump
```

恢复过程中可能出现扩展/所有者相关提示属正常，应以最终表行数为准：

```powershell
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM occurrence_clean;"
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM species_lookup;"
psql -h localhost -U postgres -d birdscope -c "SELECT grid_size, count(*) FROM occurrence_grid_monthly GROUP BY grid_size ORDER BY grid_size;"
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM occurrence_stats_monthly;"
```

预期：`occurrence_clean` ≈ 3,997,847；`species_lookup` ≈ 9,807；`occurrence_grid_monthly` 1.0° ≈ 26,339 / 0.5° ≈ 63,722；`occurrence_stats_monthly` ≈ 775,726。

更多恢复/重建说明见 [deploy/README.md](deploy/README.md)。

### 2. 配置并启动后端

```powershell
Copy-Item backend\.env.example backend\.env
```

编辑 `backend/.env`，至少填写数据库密码与本机 Python 路径：

```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=birdscope
DB_USER=postgres
DB_PASSWORD=你的 postgres 密码

GEOSERVER_URL=http://localhost:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASSWORD=你的 GeoServer 密码
GEOSERVER_WORKSPACE=birdscope
GEOSERVER_DATASTORE=birdscope_pg
GEOSERVER_API_KEY=                 # 留空=本地不鉴权；共享环境须设随机长字符串

PYTHON_PATH=你的 python.exe 绝对路径
APP_DEBUG=true
```

安装依赖并启动：

```powershell
cd backend
$PYTHON = ((Get-Content .env | Select-String "^PYTHON_PATH=").Line -split "=",2)[1]
& $PYTHON -m pip install -r requirements.txt
& $PYTHON -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

验证：`http://localhost:8000/health`、`http://localhost:8000/docs`。

### 3. 初始化 GeoServer

确认 GeoServer 2.28.1 已启动、`http://localhost:8080/geoserver/web/` 可访问，然后在 `backend/` 目录执行：

```powershell
$PYTHON = ((Get-Content .env | Select-String "^PYTHON_PATH=").Line -split "=",2)[1]
& $PYTHON scripts/setup_geoserver.py
```

脚本幂等完成：创建 workspace `birdscope`、PostGIS datastore `birdscope_pg`、上传 `grid_heatmap` 样式、发布 `birdscope:occurrence_grid_monthly` 并绑定默认样式。

> 本机 GeoServer 若为 Windows 服务，长时间运行后偶发假死，重启即可：`Restart-Service GeoServer`。

### 4. 启动前端

另开一个 PowerShell：

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

默认 API 地址已是 `http://localhost:8000/api/v1`。如需覆盖，复制 `frontend/.env.example` 为 `frontend/.env.local` 并配置 `VITE_API_BASE_URL`。浏览器访问 `http://localhost:5173`。

生产构建：`npm.cmd run build`（Cesium/ECharts 会提示大 chunk，属预期）。

---

## 四、一键启动脚本

数据库与 GeoServer 就绪后，可用根目录 `start.ps1` 启动后端与前端：

```powershell
.\start.ps1              # 检查状态，然后启动后端 + 前端
.\start.ps1 -CheckOnly   # 只做状态检查，不启动
.\start.ps1 -NoBackend   # 跳过后端
.\start.ps1 -NoFrontend  # 跳过前端
```

---

## 五、启动顺序与验证

```text
PostgreSQL/PostGIS
    -> FastAPI（localhost:8000）
    -> GeoServer 图层初始化/检查（localhost:8080）
    -> Vite 前端（localhost:5173）
```

依次验证：`/health` → `/docs` → WMS GetMap → `http://localhost:5173`。后端/前端的逐项验收清单见 [backend-docs/progress.md](backend-docs/progress.md) 与 [frontend-docs/progress.md](frontend-docs/progress.md)。

---

## 六、常见问题

| 问题 | 检查 |
|------|------|
| 5432 无法连接 | PostgreSQL 服务是否启动；端口是否被其他版本占用 |
| `extension postgis is not available` | 是否为 PostgreSQL 18 安装了对应 PostGIS 3.6 |
| FastAPI 数据库认证失败 | `backend/.env` 密码是否与 postgres 用户一致 |
| GeoServer datastore 连接失败 | PostgreSQL 是否监听 localhost；GeoServer 视角下 `DB_HOST` 是否正确 |
| localhost 请求走代理超时 | 将 `localhost`/`127.0.0.1` 加入代理绕过列表 |
| `npm.ps1` 被执行策略阻止 | 前端统一使用 `npm.cmd` |

---

## 七、Docker（可选）

`deploy/docker-compose.yml` 与 `deploy/Dockerfile` 保留为可选交付方式（PostGIS 自动恢复数据 + FastAPI，不含 GeoServer）。仅在明确需要容器时使用：

```powershell
cd deploy
docker compose up -d
```

本地原生运行时不要同时启动该 compose，否则会与本机 PostgreSQL/FastAPI 争用 `5432`/`8000` 端口。详见 [deploy/README.md](deploy/README.md)。

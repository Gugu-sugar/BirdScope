# BirdScope 后端本地开发与运行

> 最后更新：2026-06-15
> 默认方式：本机 PostgreSQL/PostGIS + 本机 Python，不使用 Docker

## 1. 当前环境

| 组件 | 当前约定 |
|------|----------|
| Python | `E:\Anaconda3\envs\devgis\python.exe`（Python 3.11） |
| PostgreSQL | 18，端口 `5432` |
| PostGIS | 3.6，与 PostgreSQL 18 对应 |
| 数据库 | `birdscope` |
| FastAPI | `http://localhost:8000` |
| GeoServer | 2.28.1，`http://localhost:8080/geoserver` |

项目代码中的 `from app.xxx` 导入假设当前目录为 `backend/`。

## 2. 安装 PostgreSQL/PostGIS

安装 PostgreSQL 18，并通过 Stack Builder 或对应安装包安装 PostGIS 3.6。确保 PostgreSQL 18 的 `bin` 目录在 PATH 中。

```powershell
psql --version
pg_restore --version
Get-Service *postgres*
Test-NetConnection localhost -Port 5432
```

数据库快照由 PostgreSQL 18.4 导出。虽然部分旧版 `pg_restore` 能读取目录信息，正式恢复仍建议使用 PostgreSQL 18 客户端和服务端，避免向下兼容问题。

## 3. 恢复全量数据

快照位置：

```text
deploy/dump/birdscope.dump
```

从仓库根目录首次恢复：

```powershell
$env:PGPASSWORD="你的 postgres 密码"
createdb -h localhost -U postgres birdscope
pg_restore -h localhost -U postgres -d birdscope `
  --no-owner --no-privileges `
  deploy/dump/birdscope.dump
```

验证：

```powershell
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM occurrence_clean;"
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM species_lookup;"
psql -h localhost -U postgres -d birdscope -c "SELECT grid_size, count(*) FROM occurrence_grid_monthly GROUP BY grid_size ORDER BY grid_size;"
```

预期：

- `occurrence_clean`：3,997,847
- `species_lookup`：9,807
- `occurrence_grid_monthly`：1.0° 约 26,339，0.5° 约 63,722

不要在已有本地修改数据时直接删库重建。重新恢复属于破坏性操作，执行前检查 [human_review.md](human_review.md)。

## 4. 配置后端

```powershell
Copy-Item backend\.env.example backend\.env
```

`backend/.env` 至少填写：

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
GEOSERVER_API_KEY=
APP_DEBUG=true
```

本地个人开发可以暂时将 `GEOSERVER_API_KEY` 留空；共享环境应设置随机长字符串。

## 5. 安装依赖和启动 FastAPI

```powershell
cd backend
E:\Anaconda3\envs\devgis\python.exe -m pip install -r requirements.txt
E:\Anaconda3\envs\devgis\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

验证：

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health
```

浏览器入口：

- Swagger：`http://localhost:8000/docs`
- OpenAPI：`http://localhost:8000/openapi.json`

## 6. 初始化 GeoServer

先确认 GeoServer Web 页面可以打开：

```text
http://localhost:8080/geoserver/web/
```

然后在 `backend/` 目录运行：

```powershell
E:\Anaconda3\envs\devgis\python.exe scripts/setup_geoserver.py
```

脚本会幂等完成：

1. 创建 workspace `birdscope`
2. 创建 PostGIS datastore `birdscope_pg`
3. 上传 `grid_heatmap` SLD
4. 发布 `birdscope:occurrence_grid_monthly`
5. 绑定默认样式并打印 WMS 自测 URL

如果 GeoServer 显示服务 Running 但网页超时，重启 Windows 服务后再试：

```powershell
Restart-Service GeoServer
```

## 7. 接口冒烟测试

```powershell
Invoke-RestMethod "http://localhost:8000/api/v1/species/search?q=Passer&limit=5"
Invoke-RestMethod "http://localhost:8000/api/v1/occurrence/points?bbox=70,20,140,55&month=10&year=2024&limit=10"
Invoke-RestMethod "http://localhost:8000/api/v1/stats/monthly?year=2024"
Invoke-RestMethod "http://localhost:8000/api/v1/stats/grid?bbox=70,20,140,55&grid_size=1&month=10&year=2024"
```

## 8. 测试

当前 `tests/test_app.py` 使用 FastAPI `TestClient`，需要额外安装 `httpx`：

```powershell
E:\Anaconda3\envs\devgis\python.exe -m pip install httpx
E:\Anaconda3\envs\devgis\python.exe -m unittest discover -s tests -v
```

现有测试覆盖 health、OpenAPI 路径和 GeoServer 写接口鉴权，尚未覆盖真实数据库查询。

## 9. 常见问题

| 问题 | 检查 |
|------|------|
| 5432 无法连接 | PostgreSQL 服务是否启动；端口是否被其他版本占用 |
| `extension postgis is not available` | 是否为 PostgreSQL 18 安装了对应 PostGIS |
| FastAPI 数据库认证失败 | `backend/.env` 密码是否与 postgres 用户一致 |
| GeoServer datastore 连接失败 | PostgreSQL 是否监听 localhost；GeoServer 视角下 DB_HOST 是否正确 |
| localhost 请求走代理 | 将 localhost/127.0.0.1 加入代理绕过列表 |
| `npm.ps1` 被执行策略阻止 | 前端使用 `npm.cmd` |

Docker 文件仍保留作可选交付方式，但本地原生开发无需运行 `docker compose`。

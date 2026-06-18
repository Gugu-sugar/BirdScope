# BirdScope 数据快照与本地恢复

> 最后更新：2026-06-16

`deploy/` 当前保存数据库快照、恢复脚本和可选 Docker 配置。项目默认按**本地原生方式**运行，不要求使用 Docker。

## 当前数据

```text
deploy/dump/birdscope.dump
```

- 大小：约 327 MB
- 格式：PostgreSQL custom dump
- 导出版本：PostgreSQL 18.4
- 数据库：`birdscope`
- 主要数据量：`occurrence_clean` 3,997,847 条、`species_lookup` 9,807 条、两档网格共约 90,061 条、`occurrence_stats_monthly` 预聚合表 775,726 条（图表预聚合，2026-06-16 新增）

## 本地前置环境

1. PostgreSQL 18
2. PostGIS 3.6（须与 PostgreSQL 18 对应）
3. PostgreSQL 18 的 `psql`、`createdb`、`pg_restore` 可在终端中调用

检查：

```powershell
psql --version
pg_restore --version
Get-Service *postgres*
```

## 首次恢复

在仓库根目录执行：

```powershell
$env:PGPASSWORD="你的 postgres 密码"
createdb -h localhost -U postgres birdscope
pg_restore -h localhost -U postgres -d birdscope `
  --no-owner --no-privileges `
  deploy/dump/birdscope.dump
```

恢复过程中可能显示扩展或所有者相关提示；最终应检查表数量，而不是只看最后一行输出。

```powershell
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM occurrence_clean;"
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM species_lookup;"
psql -h localhost -U postgres -d birdscope -c "SELECT grid_size, count(*) FROM occurrence_grid_monthly GROUP BY grid_size ORDER BY grid_size;"
psql -h localhost -U postgres -d birdscope -c "SELECT count(*) FROM occurrence_stats_monthly;"
```

## 重新恢复

以下操作会删除本地 `birdscope` 数据库，请先确认没有需要保留的本地改动：

```powershell
$env:PGPASSWORD="你的 postgres 密码"
dropdb -h localhost -U postgres birdscope
createdb -h localhost -U postgres birdscope
pg_restore -h localhost -U postgres -d birdscope `
  --no-owner --no-privileges `
  deploy/dump/birdscope.dump
```

## 连接项目

复制 `backend/.env.example` 为 `backend/.env`，配置：

```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=birdscope
DB_USER=postgres
DB_PASSWORD=你的 postgres 密码
```

然后按根目录 [README.md](../README.md) 启动 FastAPI、GeoServer 和前端。

## Docker 说明

`docker-compose.yml` 和 `Dockerfile` 仍保留为可选交付方式。只有明确要使用容器时才执行：

```powershell
cd deploy
docker compose up -d
```

本地原生运行时不要同时启动该 compose，否则本机 PostgreSQL/FastAPI 可能与容器争用 `5432`、`8000` 端口。

# BirdScope 后端 — 本地一键起（前端联调指南）

> 这份文档面向**第一次接触本项目、没用过 Docker / 数据库**的同学。照着从上往下做，
> 大约 10 分钟（加上首次下载镜像和导入数据的等待）就能在自己电脑上把后端跑起来。

---

## 1. 这是什么

BirdScope 是一个**全球观鸟数据地图**项目。这个 `deploy/` 包让你在自己电脑上一条命令就能跑起
后端的两样东西：

- **PostGIS 数据库**：装着 399.8 万条真实观鸟记录（2024 年 8–11 月，全球，9807 个物种）
- **FastAPI 服务**：对外提供 HTTP 接口，前端直接调

你**不需要**装 Python、不需要会写 SQL、不需要懂 PostGIS。所有东西都在 Docker 容器里跑好了。

---

## 2. 跑起来之后你会得到

| 东西 | 地址 | 用途 |
|------|------|------|
| API 服务 | `http://localhost:8000` | 前端调接口的基地址 |
| 在线调试页（Swagger） | `http://localhost:8000/docs` | 浏览器里点点点就能试接口 |
| 健康检查 | `http://localhost:8000/health` | 返回 `{"status":"ok"}` 说明活着 |
| 数据库 | `localhost:5432`（库名 `birdscope`，用户/密码 `postgres`/`postgres`）| 一般不用直接连 |

> 不含 GeoServer。当前所有地图功能用 FastAPI 接口就能覆盖（见第 8 节）。

---

## 3. 环境准备（唯一前置：装 Docker Desktop）

**Windows**：下载并安装 Docker Desktop → https://www.docker.com/products/docker-desktop/
- 安装时按提示启用 **WSL2**（Windows 子系统），装完重启电脑。

**macOS**：同一个下载页，选对应芯片（Apple 芯片 / Intel）的版本安装。

装完打开 Docker Desktop（让它保持运行），然后打开终端验证：

```bash
docker --version
docker compose version
```

两条都能打印出版本号就 OK。

---

## 4. 拿数据文件（dump）

数据库快照文件 `birdscope.dump`（约几百 MB）**太大，不放在代码仓库里**，由后端同学通过
网盘 / U 盘单独发给你。

拿到后，把它放到这个目录下（文件名不要改）：

```
deploy/dump/birdscope.dump
```

放对位置后，`deploy/dump/` 里应该能看到 `birdscope.dump`、`README.md`、`.gitignore` 三个东西。

---

## 5. 启动（一条命令）

打开终端，进入 `deploy` 目录，执行：

```bash
cd deploy
docker compose up -d
```

**首次启动会比较慢**（可能 3–10 分钟），因为它在做两件事：

1. 从网上下载 PostGIS 和 Python 镜像（只有第一次需要）
2. 把 400 万行数据导入数据库（只有第一次需要）

请耐心等待，不要中途 Ctrl+C。之后再启动就是秒级了。

---

## 6. 怎么确认起来了

**① 看两个服务状态**：

```bash
docker compose ps
```

`birdscope-db` 显示 `healthy`、`birdscope-api` 在 `running`，就对了。

**② 确认数据导入完成**（看到 `Restore done.` 即可）：

```bash
docker compose logs db
```

**③ 浏览器打开** http://localhost:8000/docs —— 看到 Swagger 接口页面就成功了。

---

## 7. 第一次调接口（手把手）

**方式 A：在 Swagger 页面点**

1. 打开 http://localhost:8000/docs
2. 找到 `GET /api/v1/species/search`，点开
3. 点 **Try it out**，在 `q` 里填 `corvus`，点 **Execute**
4. 下方 Response 出现一串物种 JSON，就说明数据库 + API 全通了

**方式 B：命令行 curl**

```bash
curl "http://localhost:8000/api/v1/species/search?q=corvus"
```

（Windows 上若装了代理，curl 加 `--noproxy localhost`。）

---

## 8. 接口清单速览

基地址：`http://localhost:8000`，所有业务接口前缀 `/api/v1`。完整参数和返回示例见
[../backend-docs/api_reference.md](../backend-docs/api_reference.md)。

| 接口 | 用途 |
|------|------|
| `GET /species/search?q=` | 物种搜索 / 搜索框自动补全 |
| `GET /species/{species_key}` | 物种详情 |
| `GET /species/rank` | 物种排行（条形图用） |
| `GET /occurrence/points?bbox=` | 矩形范围内观测点（地图放大时用，硬上限 5000） |
| `POST /occurrence/within` | 多边形框选内的点 |
| `GET /occurrence/buffer?lat=&lng=&radius_km=` | 圆形缓冲区查询（点地图 + 半径） |
| `GET /stats/monthly` | 月度趋势（折线图用） |
| `GET /stats/province` | 省级统计 |
| `GET /stats/grid?bbox=&grid_size=` | 网格聚合热力（GeoJSON，地图中等缩放用） |
| `GET /stats/migration?species_key=` | 物种观测重心按月迁移（注意：是观测重心，不是单只鸟轨迹） |

**地图分级渲染建议**：
- 大范围 / 小比例尺 → 用 `/stats/grid`（预聚合网格，返回 GeoJSON 多边形，画热力）
- 放大到局部 → 用 `/occurrence/points`（返回点，最多 5000 个）

返回的 GeoJSON 可以直接喂给 Leaflet / Mapbox / Cesium。

---

## 9. 前端怎么连

- API 基地址写 `http://localhost:8000`
- 后端已开启 CORS（允许所有来源），前端跨域直接调，无需额外配置
- `/stats/grid`、`/occurrence/points`、`/occurrence/within`、`/occurrence/buffer` 返回的是
  标准 **GeoJSON FeatureCollection**，地图库可直接渲染

---

## 10. 日常操作

| 你想做的事 | 命令 |
|-----------|------|
| 停掉服务（**数据保留**） | `docker compose down` |
| 再次启动 | `docker compose up -d` |
| 改了后端代码后重建 API | `docker compose up -d --build` |
| 看实时日志 | `docker compose logs -f api`（或 `db`） |
| 彻底重置（**清空数据库**，下次启动重新导入） | `docker compose down -v` 然后 `docker compose up -d` |

> `docker compose down` 不加 `-v` 不会删数据；只有加 `-v` 才会清空数据卷。

---

## 11. 常见问题 FAQ

**Q：端口 5432 或 8000 被占用 / 启动报 "port is already allocated"？**
你本机可能已经装了 PostgreSQL（占 5432）或别的服务占了 8000。编辑 `deploy/docker-compose.yml`，
把对应的 `ports` 左边的宿主机端口改掉，例如 `"15432:5432"`、`"18000:8000"`，然后访问改用新端口。

**Q：首次启动卡很久正常吗？**
正常。第一次要下载镜像 + 导入 400 万行数据，3–10 分钟都可能。用 `docker compose logs -f db`
看进度，出现 `Restore done.` 就好了。

**Q：接口报数据库连不上 / 没数据？**
确认 `deploy/dump/birdscope.dump` 文件确实存在且文件名正确；若是空库，多半是 dump 没放对位置。
重新放好后执行 `docker compose down -v && docker compose up -d` 重来一次。

**Q：镜像下载特别慢 / 拉不动？**
给 Docker Desktop 配国内镜像加速源（Settings → Docker Engine，加 `registry-mirrors`），
或让后端同学把镜像离线导出（`docker save`）发给你。

**Q：Windows 上 `20-restore.sh` 报格式错误？**
该脚本必须是 LF 换行。仓库里已是 LF；如果你用编辑器改过它，注意别保存成 CRLF。

**Q：怎么直接连数据库看表？**
用任意 PG 客户端连 `localhost:5432`，库 `birdscope`，用户/密码 `postgres`/`postgres`。
三张表：`occurrence_clean`（明细）、`species_lookup`（物种）、`occurrence_grid_monthly`（预聚合网格）。

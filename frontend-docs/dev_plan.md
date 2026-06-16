# BirdScope 前端本地运行与联调

> 最后更新：2026-06-15

## 前置

- Node.js：当前本机 `v24.14.0`
- npm：当前本机 `11.9.0`
- FastAPI：`http://localhost:8000`
- GeoServer：`http://localhost:8080/geoserver`

## 安装和启动

PowerShell 中使用 `npm.cmd`，避免 `npm.ps1` 执行策略问题：

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

访问 `http://localhost:5173`。

当前 `package-lock.json` 已包含 Cesium 和 ECharts 依赖，干净环境应优先使用 `npm ci`，不要随意删除 lock 文件。

## API 配置

默认值：

```text
http://localhost:8000/api/v1
```

需要覆盖时：

```powershell
Copy-Item .env.example .env.local
```

```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## 构建

```powershell
npm.cmd run build
```

构建产物位于 `frontend/dist/`。当前 Cesium + ECharts 主包较大，Vite 会提示 chunk size warning，但不阻止构建。

## 联调前检查

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health
Invoke-WebRequest -UseBasicParsing http://localhost:8080/geoserver/web/
```

## 手工冒烟

1. 打开 `http://localhost:5173`，确认 Cesium 画布出现。
2. 打开浏览器开发者工具 Console 和 Network。
3. 选择 8–11 月并播放时间滑块。
4. 使用 bbox、polygon、buffer 三种空间选择。
5. 执行查询，检查 occurrence 请求返回 200，地图出现点位。
6. 检查三个统计接口返回 200，ECharts 有数据。
7. 缩放到全球视图，检查 WMS 请求和热力图。

## 当前预期问题

- 物种搜索可能因数组/包装对象响应不一致而报错。
- WMS 请求尚未按契约使用 `CQL_FILTER`，热力图可能叠加多个粒度和月份。
- 查询结果列表当前不显示，只能在地图查看点位。

上述问题修复并通过浏览器冒烟前，不应将前端标记为完整联调完成。


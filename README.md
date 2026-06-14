# BirdScope

BirdScope 是基于 GBIF/eBird 鸟类观测数据的三维地图查询与可视化项目。

## 文档

- 项目级 Agent 参考：[AGENT.md](AGENT.md)
- 后端文档：[backend-docs/](backend-docs/)
- 前端文档：[frontend-docs/](frontend-docs/)

## 前端开发

3 号任务前端代码位于 `frontend/`，技术栈为 Vite + React + TypeScript + Tailwind CSS。

```powershell
cd frontend
npm install
npm run dev
```

默认前端开发地址为 `http://localhost:5173`。

## 前端构建

```powershell
cd frontend
npm run build
```

## 后端联调

前端默认请求后端地址：

```text
http://localhost:8000/api/v1
```

如果后端地址不同，可以在 `frontend/.env.local` 中配置：

```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

联调前请确认 FastAPI 服务可访问：

```powershell
Invoke-WebRequest http://localhost:8000/health
```

前端查询流程：

1. 输入至少 2 个字符搜索物种。
2. 选择 2024 年 8-11 月中的一个月份。
3. 在地图占位区点击样例空间范围，后续可由 Cesium 绘制结果替换。
4. 点击“执行查询”，右侧结果列表显示观测记录。

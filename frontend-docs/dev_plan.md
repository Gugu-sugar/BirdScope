# BirdScope 前端开发与联调

> 最后更新：2026-06-14

## 环境

- Node.js：按 `frontend/package-lock.json` 对应版本安装依赖。
- 包管理：当前仓库使用 `npm`。
- 开发服务器：Vite，默认端口 `5173`。

## 安装与启动

```powershell
cd frontend
npm install
npm run dev
```

默认访问地址：

```text
http://localhost:5173
```

## 构建

```powershell
cd frontend
npm run build
```

构建脚本会先执行 TypeScript build，再执行 Vite build：

```json
"build": "tsc -b && vite build"
```

## 后端联调

前端默认请求：

```text
http://localhost:8000/api/v1
```

如需覆盖地址，在 `frontend/.env.local` 中设置：

```ini
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

联调前确认后端服务可用：

```powershell
Invoke-WebRequest http://localhost:8000/health
```

## 手工冒烟流程

1. 启动后端 FastAPI 服务。
2. 启动前端 Vite 服务。
3. 打开 `http://localhost:5173`。
4. 输入至少 2 个字符搜索物种，如 `Passer`。
5. 选择月份。
6. 在地图区域点击一个空间样例。
7. 点击“执行查询”。
8. 右侧结果列表应出现观测记录，或展示明确错误信息。

## 常见问题

| 问题 | 检查点 |
|------|--------|
| 物种搜索失败 | 后端 `/api/v1/species/search` 是否可访问；`VITE_API_BASE_URL` 是否正确 |
| 查询按钮返回“请选择空间范围” | 当前空间模式下没有写入对应 `bbox` / `polygon` / `buffer` |
| CORS 报错 | 后端 FastAPI CORS 是否允许前端地址 |
| 返回空结果 | 检查月份、物种、空间范围组合是否过窄 |
| 中文显示乱码 | 确认文件按 UTF-8 读取和保存 |


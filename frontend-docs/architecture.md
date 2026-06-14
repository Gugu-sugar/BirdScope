# BirdScope 前端技术架构

> 最后更新：2026-06-14

## 目录结构

```text
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.tsx                 # React DOM 挂载入口
    ├── App.tsx                  # 注入 QueryProvider 并渲染页面
    ├── styles.css               # Tailwind 入口 + 当前视觉组件样式
    ├── pages/
    │   └── MapQueryPage.tsx     # 查询工作台页面组合
    ├── components/
    │   ├── map/
    │   │   └── MapPanel.tsx     # 地图区域，占位预览和样例空间范围
    │   └── query/
    │       ├── QueryPanel.tsx   # 查询条件表单
    │       └── ResultList.tsx   # GeoJSON 查询结果列表
    ├── store/
    │   └── queryStore.tsx       # React Context 查询状态和动作
    ├── api/
    │   ├── client.ts            # API base、query string、错误封装
    │   ├── occurrence.ts        # 观测点相关接口
    │   ├── species.ts           # 物种搜索接口
    │   └── stats.ts             # 网格统计接口
    └── types/
        ├── api.ts               # 后端响应 TypeScript 类型
        └── geo.ts               # bbox、GeoJSON、空间选择类型
```

## 组件分层

```text
App
└── QueryProvider
    └── MapQueryPage
        ├── QueryPanel
        ├── MapPanel
        └── ResultList
```

- `MapQueryPage` 负责页面布局和空间选择互斥逻辑。
- `QueryPanel` 负责用户输入，不直接拼接口参数。
- `MapPanel` 负责产生空间选择结果，后续 Cesium 绘制应继续通过 props 回传 `bbox` / `polygon` / `buffer center`。
- `ResultList` 只消费查询结果，不触发请求。
- `queryStore.tsx` 是当前查询业务状态中心。

## 状态流

```text
用户输入
  ↓
QueryPanel / MapPanel
  ↓
QueryProvider state
  ↓
runCurrentQuery()
  ↓
api/* 封装
  ↓
FastAPI /api/v1
  ↓
OccurrenceGeoJSON
  ↓
ResultList 展示
```

`QueryProvider` 当前维护：

- `selectedSpecies`
- `month`
- `spatialMode`
- `bbox`
- `polygon`
- `buffer`
- `radiusKm`
- `results`
- `loading`
- `error`

空间模式互斥规则在 `MapQueryPage` 中执行：选择一种空间范围后，会清空另外两种空间范围。

## 后续地图接入点

`MapPanel` 接入 Cesium 时建议保持当前对外契约：

- 矩形绘制完成：调用 `onBboxSelected(bbox)`
- 多边形绘制完成：调用 `onPolygonSelected(geometry)`
- 缓冲区中心点选择完成：调用 `onBufferCenterSelected(point)`
- 地图展示当前状态：读取 `bbox`、`polygon`、`buffer`、`spatialMode`

地图数据源建议按缩放层级接入：

| 视图层级 | 数据源 | 当前状态 |
|----------|--------|----------|
| 全球热力 | GeoServer WMS `birdscope:occurrence_grid_monthly` | 待接入 |
| 区域网格 | `GET /api/v1/stats/grid` | API 已封装，UI 待接入 |
| 本地点位 | `GET /api/v1/occurrence/points` | 查询列表已接入 |


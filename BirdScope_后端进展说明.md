# BirdScope 后端进展说明

> 更新时间：2026-06-05 | 面向：全组同学

---

## 现在后端能做什么

**一句话：后端 API 已经跑起来了，可以接受请求并返回数据。**

服务地址：`http://localhost:8000`
接口文档（可以直接点按钮测试）：`http://localhost:8000/docs`

目前数据库里有 **2000 条全球样本**，覆盖中国、澳大利亚、英国、印度、巴西等 10 个国家，8–11 月四个月份。这是开发用的小样本，用来验证接口格式都对了——后续会换成全量数据。

---

## 有哪些接口，前端怎么用

### 1. 物种搜索 / 信息

| 用途 | 请求示例 |
|------|---------|
| 搜索框输入关键词查物种 | `GET /api/v1/species/search?q=Pycnonotus` |
| 获取某个物种的详情 | `GET /api/v1/species/5228134` |
| 物种排行（给 ECharts 条形图用）| `GET /api/v1/species/rank?country_code=CN&month=10` |

返回格式举例：
```json
[
  { "species_key": 5228134, "display_name": "Pycnonotus sinensis", "record_count": 17 },
  { "species_key": 2479598, "display_name": "Eolophus roseicapilla", "record_count": 15 }
]
```

---

### 2. 地图点数据（Cesium 大比例尺时用）

| 用途 | 请求示例 |
|------|---------|
| 矩形范围内的鸟类观测点 | `GET /api/v1/occurrence/points?bbox=70,20,140,55&month=10` |
| 手绘多边形内的点（框选查询）| `POST /api/v1/occurrence/within`（body 传 GeoJSON 多边形）|
| 点击地图某点 + 设置半径查询 | `GET /api/v1/occurrence/buffer?lat=31.2&lng=121.5&radius_km=50` |

返回格式是标准 **GeoJSON FeatureCollection**，Cesium 可以直接加载：
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [121.47, 31.23] },
      "properties": {
        "gbif_id": 5386589584,
        "species": "Spilopelia chinensis",
        "individual_count": 2,
        "event_date": "2024-10-03",
        "locality": "上海世纪公园",
        "country_code": "CN",
        "state_province": "Shanghai"
      }
    }
  ],
  "total": 1
}
```

**每次最多返回 2000 个点**，前端不用担心数据量太大。

---

### 3. 统计数据（给 ECharts 图表用）

| 用途 | 请求示例 | 返回 |
|------|---------|------|
| 月度趋势折线图 | `GET /api/v1/stats/monthly?country_code=CN` | 4个月的记录数 |
| 省级分布 | `GET /api/v1/stats/province?country_code=CN` | 各省记录数排行 |
| 中等比例尺热力网格 | `GET /api/v1/stats/grid?bbox=70,20,140,55&grid_size=1` | GeoJSON 网格 |
| 物种迁徙重心（按月） | `GET /api/v1/stats/migration?species_key=5228134` | 每月质心经纬度 |

月度趋势返回格式：
```json
[
  { "month": 8,  "record_count": 500, "individual_sum": 3261 },
  { "month": 9,  "record_count": 500, "individual_sum": 10257 },
  { "month": 10, "record_count": 500, "individual_sum": 4189 },
  { "month": 11, "record_count": 500, "individual_sum": 3915 }
]
```

---

### 4. GeoServer 图层管理

| 用途 | 请求 |
|------|------|
| 查看已发布图层 | `GET /api/v1/geoserver/layers` |
| 发布新图层 | `POST /api/v1/geoserver/layers` |
| 删除图层 | `DELETE /api/v1/geoserver/layers/{name}` |
| 切换图层样式 | `PUT /api/v1/geoserver/layers/{name}/style` |

GeoServer 本身还没配（是第三天的任务），但接口已经写好了，配好之后直接可用。

---

## 前端对接时的约定

**1. 所有坐标都是 WGS-84（经度在前，纬度在后）**
- bbox 格式：`minx,miny,maxx,maxy`，比如中国大致范围是 `73,18,135,54`
- GeoJSON coordinates 格式：`[经度, 纬度]`，即 `[116.4, 39.9]`

**2. 时间滑块切换月份**
- 大比例尺（看到单个点）：给 occurrence 接口加 `&month=10` 参数
- 小比例尺（看热力图）：切换 GeoServer WMS 的 `CQL_FILTER=month=10`（GeoServer 配好后）

**3. 缩放级别和数据来源**

| Cesium 缩放 | 看到什么 | 数据来源 |
|------------|---------|---------|
| 全球视角（小） | 热力图 | GeoServer WMS（待配） |
| 区域视角（中）| 格子热力 | `/api/v1/stats/grid` |
| 本地视角（大）| 真实点 | `/api/v1/occurrence/points` |

**4. species 字段可能为空**
极少数记录没有精确到"种"，`species` 字段为 `null`，这时用 `scientific_name` 字段展示就行。

**5. individual_count 可能为空**
约 5% 的记录没有个体数量，`individual_count` 为 `null`，展示时当作"数量未知"处理即可，不要当 0。

---

## 接下来的计划

| 什么时候 | 做什么 |
|---------|--------|
| 明天 | 跑全量 15GB 数据处理脚本（约 1 小时），换成真实数据 |
| 后天 | 配 GeoServer，发布全球热力图 WMS |
| 第四天起 | 和前端联调，按需调整格式 |

---

## 本地启动方式（给想自己跑一下的同学）

需要先建好 PostgreSQL 数据库（安装了 PostGIS 扩展），然后：

```powershell
# 1. 复制并填写配置
copy backend\.env.example backend\.env
# 编辑 .env，填写 DB_PASSWORD

# 2. 安装依赖
D:\conda_env\conda_envs\devgis\python.exe -m pip install -r backend\requirements.txt

# 3. 建表 + 导入样本数据
psql -U postgres -d birdscope -f backend\scripts\init_db.sql
D:\conda_env\conda_envs\devgis\python.exe backend\scripts\import_to_pg.py

# 4. 启动服务
cd backend
D:\conda_env\conda_envs\devgis\python.exe -m uvicorn app.main:app --reload
```

然后打开 `http://localhost:8000/docs` 就能看到所有接口并直接测试。

---

有任何格式或字段的问题，直接来找我对，接口都可以改。

"""
setup_geoserver.py — 一键初始化 GeoServer 图层发布（第三阶段）

幂等执行以下步骤（已存在的对象会跳过/覆盖，可重复运行）：
  1. 探测 GeoServer 是否可达
  2. 建 workspace（birdscope）
  3. 建连接 PostGIS 的 datastore（birdscope_pg）
  4. 上传 SLD 分级配色样式（styles/grid_heatmap.sld → 样式名 grid_heatmap）
  5. 发布 occurrence_grid_monthly 为 FeatureType 图层，并设为默认样式
  6. 打印一条 WMS GetMap 示例 URL，供前端/浏览器自测

前置：GeoServer 服务必须已启动（默认 http://localhost:8080/geoserver）。
配置取自 backend/.env（GEOSERVER_* 与 DB_*），通过 app.config.settings 读取。

用法（在 backend/ 目录下）：
    E:/Anaconda3/envs/devgis/python.exe scripts/setup_geoserver.py
    # GeoServer 跑在 Docker、DB 在宿主机时：
    E:/Anaconda3/envs/devgis/python.exe scripts/setup_geoserver.py --db-host host.docker.internal
"""
import argparse
import os
import sys

# 本机代理会拦截 localhost；显式清掉避免 GeoServer 请求走代理超时
for _k in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"):
    os.environ.pop(_k, None)

# 允许 `python scripts/setup_geoserver.py` 直接运行（把 backend/ 加入 import 路径）
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import requests

from app.config import settings
from app.services import geoserver as gs

STYLE_NAME = "grid_heatmap"
SLD_PATH = os.path.join(os.path.dirname(__file__), "..", "styles", "grid_heatmap.sld")


def check_reachable() -> None:
    url = f"{settings.geoserver_url}/rest/about/version.json"
    try:
        r = requests.get(
            url,
            auth=(settings.geoserver_user, settings.geoserver_password),
            timeout=8,
        )
        r.raise_for_status()
    except Exception as e:
        print(f"[x] GeoServer 不可达：{url}\n    {e}")
        print("    请先启动 GeoServer（默认端口 8080），确认 .env 中 GEOSERVER_URL / 账号密码正确。")
        sys.exit(1)
    print(f"[ok] GeoServer 可达：{settings.geoserver_url}")


def main() -> None:
    p = argparse.ArgumentParser(description="一键初始化 GeoServer 图层发布")
    p.add_argument(
        "--db-host",
        default=None,
        help="datastore 连接 DB 时使用的主机（GeoServer 视角）；默认取 .env 的 DB_HOST",
    )
    p.add_argument("--layer", default="occurrence_grid_monthly", help="发布的图层名")
    p.add_argument(
        "--table", default="occurrence_grid_monthly", help="对应的 PostGIS 表名"
    )
    args = p.parse_args()

    check_reachable()

    print(gs.ensure_workspace())
    print(gs.ensure_datastore(db_host=args.db_host))

    with open(SLD_PATH, encoding="utf-8") as f:
        sld = f.read()
    print(gs.create_or_update_style(STYLE_NAME, sld))

    if gs.layer_exists(args.layer):
        print({"status": "exists", "layer": args.layer})
    else:
        print(gs.publish_layer(args.layer, args.table, style_name=STYLE_NAME))
    # defaultStyle 是 Layer（非 FeatureType）属性，发布时 payload 内的 defaultStyle
    # 会被 GeoServer 忽略而退回全局 polygon 样式，故无论新建/已存在都显式绑定一次
    print(gs.set_layer_style(args.layer, STYLE_NAME))

    # 示例 WMS GetMap：默认渲染所有行；前端应按需加 CQL_FILTER 过滤粒度/月份，
    # 例如全球 1.0° 热力：CQL_FILTER=grid_size=1.0 AND month=10
    ws = settings.geoserver_workspace
    sample = (
        f"{settings.geoserver_url}/{ws}/wms?service=WMS&version=1.1.0&request=GetMap"
        f"&layers={ws}:{args.layer}&styles="
        f"&bbox=-180,-90,180,90&width=1024&height=512&srs=EPSG:4326&format=image/png"
        f"&transparent=true&CQL_FILTER=grid_size%3D1.0%20AND%20month%3D10"
    )
    print("\n[完成] WMS GetMap 自测 URL（浏览器打开应看到全球 10 月 1.0° 热力图）：")
    print(sample)


if __name__ == "__main__":
    main()

"""GeoServer 2.28.1 REST API 客户端。"""
import re

import requests
from requests.auth import HTTPBasicAuth
from app.config import settings


IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
CQL_FILTER_RE = re.compile(r"^[A-Za-z0-9_\s.'\"<>=!()+\-*/%:,]+$")
GEOMETRY_TYPES = {
    "occurrence_clean": "Point",
    "occurrence_grid_monthly": "Polygon",
}
KEY_COLUMNS = {
    "occurrence_clean": "gbif_id",
    "occurrence_grid_monthly": "id",
}
# 物种实时聚合允许的网格粒度（度）；与前端 GridSize 一致并留有余量
ALLOWED_GRID_SIZES = {1.0, 0.5, 0.25, 0.1}
# 虚拟表无自然范围，POST featuretype 时须显式声明 bbox，否则 GeoServer
# 无法自动推算 SQL View 的空间范围，WMS GetMap 会失败。前端 GetMap 自带
# bbox 参数，故这里声明全球范围即可，不影响渲染。
WORLD_BBOX = {"minx": -180, "miny": -90, "maxx": 180, "maxy": 90, "crs": "EPSG:4326"}


def _auth() -> HTTPBasicAuth:
    return HTTPBasicAuth(settings.geoserver_user, settings.geoserver_password)


def _base() -> str:
    return f"{settings.geoserver_url}/rest"


def _ws() -> str:
    return settings.geoserver_workspace


def _validate_identifier(value: str, label: str) -> None:
    if not IDENTIFIER_RE.fullmatch(value):
        raise ValueError(f"{label} must be a simple SQL identifier")


def _validate_cql_filter(cql_filter: str) -> None:
    if ";" in cql_filter or "--" in cql_filter or "/*" in cql_filter or "*/" in cql_filter:
        raise ValueError("cql_filter contains unsafe SQL comment or statement separator")
    if not CQL_FILTER_RE.fullmatch(cql_filter):
        raise ValueError("cql_filter contains unsupported characters")


def _feature_type_payload(
    layer_name: str,
    table_name: str,
    style_name: str | None = None,
    cql_filter: str | None = None,
) -> dict:
    _validate_identifier(layer_name, "layer_name")
    _validate_identifier(table_name, "table_name")

    feature_type = {
        "name": layer_name,
        "nativeName": table_name,
        "title": layer_name,
        "srs": "EPSG:4326",
    }
    if style_name:
        feature_type["defaultStyle"] = {"name": style_name, "workspace": _ws()}

    if cql_filter:
        _validate_cql_filter(cql_filter)
        geom_type = GEOMETRY_TYPES.get(table_name, "Geometry")
        key_column = KEY_COLUMNS.get(table_name, "id")
        feature_type["nativeName"] = layer_name
        feature_type["metadata"] = {
            "entry": {
                "@key": "JDBC_VIRTUAL_TABLE",
                "virtualTable": {
                    "name": layer_name,
                    "sql": f"SELECT * FROM {table_name} WHERE {cql_filter}",
                    "escapeSql": False,
                    "keyColumn": key_column,
                    "geometry": {
                        "name": "geom",
                        "type": geom_type,
                        "srid": 4326,
                    },
                },
            }
        }

    return {"featureType": feature_type}


def _species_grid_payload(
    layer_name: str,
    species_key: int,
    grid_size: float,
    month: int | None,
    year: int,
) -> dict:
    """构造按物种实时聚合的 SQL View 虚拟表 payload。

    从 occurrence_clean 按 species_key + year(+ month) 过滤，按 grid_size 把
    观测点 floor 到网格并 ST_MakeEnvelope 还原为多边形格子，COUNT(*) 作为
    record_count。输出 Polygon + record_count，与预聚合表同构，直接复用
    grid_heatmap 样式。

    所有插值参数均为已校验的数值（int/float），无注入风险。
    """
    _validate_identifier(layer_name, "layer_name")
    if not isinstance(species_key, int) or species_key <= 0:
        raise ValueError("species_key must be a positive integer")
    gs = float(grid_size)
    if gs not in ALLOWED_GRID_SIZES:
        raise ValueError(f"grid_size must be one of {sorted(ALLOWED_GRID_SIZES)}")
    yr = int(year)
    month_clause = ""
    if month is not None:
        m = int(month)
        if not 1 <= m <= 12:
            raise ValueError("month must be between 1 and 12")
        month_clause = f" AND month = {m}"

    sql = (
        "SELECT row_number() OVER () AS cell_id, "
        f"ST_MakeEnvelope(gx*{gs}, gy*{gs}, gx*{gs}+{gs}, gy*{gs}+{gs}, 4326) AS geom, "
        "record_count, individual_sum FROM ("
        f"SELECT floor(ST_X(geom)/{gs}) AS gx, floor(ST_Y(geom)/{gs}) AS gy, "
        "COUNT(*)::int AS record_count, SUM(individual_count)::int AS individual_sum "
        "FROM occurrence_clean "
        f"WHERE species_key = {species_key} AND year = {yr}{month_clause} "
        "GROUP BY 1, 2) cells"
    )

    feature_type = {
        "name": layer_name,
        "nativeName": layer_name,
        "title": layer_name,
        "srs": "EPSG:4326",
        "nativeBoundingBox": WORLD_BBOX,
        "latLonBoundingBox": WORLD_BBOX,
        "metadata": {
            "entry": {
                "@key": "JDBC_VIRTUAL_TABLE",
                "virtualTable": {
                    "name": layer_name,
                    "sql": sql,
                    "escapeSql": False,
                    "keyColumn": "cell_id",
                    "geometry": {
                        "name": "geom",
                        "type": "Polygon",
                        "srid": 4326,
                    },
                },
            }
        },
    }
    return {"featureType": feature_type}


def publish_species_grid_layer(
    layer_name: str,
    species_key: int,
    grid_size: float = 1.0,
    month: int | None = None,
    year: int = 2024,
    style_name: str | None = None,
) -> dict:
    """按物种实时聚合发布一个网格热力图层（GeoServer SQL View）。"""
    url = (
        f"{_base()}/workspaces/{_ws()}/datastores/"
        f"{settings.geoserver_datastore}/featuretypes"
    )
    payload = _species_grid_payload(layer_name, species_key, grid_size, month, year)

    r = requests.post(url, json=payload, auth=_auth(), timeout=20)
    r.raise_for_status()
    # defaultStyle 是 Layer 属性，发布 featuretype 时 payload 内会被忽略，
    # 故发布后显式绑定一次（与 setup_geoserver.py 同处理）
    if style_name:
        set_layer_style(layer_name, style_name)
    return {
        "status": "created",
        "layer": layer_name,
        "species_key": species_key,
        "grid_size": grid_size,
        "month": month,
        "year": year,
    }


def ensure_workspace() -> dict:
    """幂等创建 workspace；已存在则跳过。"""
    ws = _ws()
    r = requests.get(f"{_base()}/workspaces/{ws}.json", auth=_auth(), timeout=10)
    if r.status_code == 200:
        return {"status": "exists", "workspace": ws}
    r = requests.post(
        f"{_base()}/workspaces",
        json={"workspace": {"name": ws}},
        auth=_auth(),
        timeout=10,
    )
    r.raise_for_status()
    return {"status": "created", "workspace": ws}


def ensure_datastore(db_host: str | None = None) -> dict:
    """幂等创建连接 PostGIS 的 datastore；已存在则跳过。

    db_host 为 GeoServer 视角下的数据库主机：
    - GeoServer 本地安装、DB 也在本机 → localhost（默认取 settings.db_host）
    - GeoServer 跑在 Docker 里、DB 在宿主机 → 传 host.docker.internal
    """
    from app.config import settings

    ws = _ws()
    ds = settings.geoserver_datastore
    r = requests.get(
        f"{_base()}/workspaces/{ws}/datastores/{ds}.json", auth=_auth(), timeout=10
    )
    if r.status_code == 200:
        return {"status": "exists", "datastore": ds}

    payload = {
        "dataStore": {
            "name": ds,
            "connectionParameters": {
                "entry": [
                    {"@key": "host", "$": db_host or settings.db_host},
                    {"@key": "port", "$": str(settings.db_port)},
                    {"@key": "database", "$": settings.db_name},
                    {"@key": "user", "$": settings.db_user},
                    {"@key": "passwd", "$": settings.db_password},
                    {"@key": "dbtype", "$": "postgis"},
                    {"@key": "schema", "$": "public"},
                    {"@key": "Expose primary keys", "$": "true"},
                ]
            },
        }
    }
    r = requests.post(
        f"{_base()}/workspaces/{ws}/datastores",
        json=payload,
        auth=_auth(),
        timeout=15,
    )
    r.raise_for_status()
    return {"status": "created", "datastore": ds}


def create_or_update_style(style_name: str, sld_body: str) -> dict:
    """幂等上传 SLD 样式到 workspace。已存在则覆盖样式内容。"""
    ws = _ws()
    headers = {"Content-Type": "application/vnd.ogc.sld+xml"}
    exists = requests.get(
        f"{_base()}/workspaces/{ws}/styles/{style_name}.json", auth=_auth(), timeout=10
    )
    if exists.status_code == 200:
        r = requests.put(
            f"{_base()}/workspaces/{ws}/styles/{style_name}",
            data=sld_body.encode("utf-8"),
            headers=headers,
            auth=_auth(),
            timeout=15,
        )
        r.raise_for_status()
        return {"status": "updated", "style": style_name}

    r = requests.post(
        f"{_base()}/workspaces/{ws}/styles?name={style_name}",
        data=sld_body.encode("utf-8"),
        headers=headers,
        auth=_auth(),
        timeout=15,
    )
    r.raise_for_status()
    return {"status": "created", "style": style_name}


def layer_exists(layer_name: str) -> bool:
    ws = _ws()
    r = requests.get(
        f"{_base()}/workspaces/{ws}/datastores/{settings.geoserver_datastore}"
        f"/featuretypes/{layer_name}.json",
        auth=_auth(),
        timeout=10,
    )
    return r.status_code == 200


def list_layers() -> list[dict]:
    url = f"{_base()}/workspaces/{_ws()}/layers.json"
    r = requests.get(url, auth=_auth(), timeout=10)
    r.raise_for_status()
    data = r.json()
    layers = data.get("layers", {}).get("layer", [])
    if isinstance(layers, dict):
        layers = [layers]
    return layers


def publish_layer(
    layer_name: str,
    table_name: str,
    style_name: str | None = None,
    cql_filter: str | None = None,
) -> dict:
    """在已有 datastore 上发布一个 PostGIS 表为 FeatureType。"""
    url = (
        f"{_base()}/workspaces/{_ws()}/datastores/"
        f"{settings.geoserver_datastore}/featuretypes"
    )
    payload = _feature_type_payload(layer_name, table_name, style_name, cql_filter)

    r = requests.post(url, json=payload, auth=_auth(), timeout=15)
    r.raise_for_status()
    result = {"status": "created", "layer": layer_name}
    if cql_filter:
        result["cql_filter"] = cql_filter
    return result


def delete_layer(layer_name: str) -> dict:
    # 先删 featureType，再删 layer
    ft_url = (
        f"{_base()}/workspaces/{_ws()}/datastores/"
        f"{settings.geoserver_datastore}/featuretypes/{layer_name}?recurse=true"
    )
    r = requests.delete(ft_url, auth=_auth(), timeout=10)
    r.raise_for_status()
    return {"status": "deleted", "layer": layer_name}


def set_layer_style(layer_name: str, style_name: str) -> dict:
    url = f"{_base()}/layers/{_ws()}:{layer_name}"
    payload = {"layer": {"defaultStyle": {"name": style_name, "workspace": _ws()}}}
    r = requests.put(url, json=payload, auth=_auth(), timeout=10)
    r.raise_for_status()
    return {"status": "updated", "layer": layer_name, "style": style_name}

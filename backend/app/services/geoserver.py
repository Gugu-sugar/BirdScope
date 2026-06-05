"""GeoServer 2.28.1 REST API 客户端。"""
import requests
from requests.auth import HTTPBasicAuth
from app.config import settings


def _auth() -> HTTPBasicAuth:
    return HTTPBasicAuth(settings.geoserver_user, settings.geoserver_password)


def _base() -> str:
    return f"{settings.geoserver_url}/rest"


def _ws() -> str:
    return settings.geoserver_workspace


def list_layers() -> list[dict]:
    url = f"{_base()}/workspaces/{_ws()}/layers.json"
    r = requests.get(url, auth=_auth(), timeout=10)
    r.raise_for_status()
    data = r.json()
    layers = data.get("layers", {}).get("layer", [])
    if isinstance(layers, dict):
        layers = [layers]
    return layers


def publish_layer(layer_name: str, table_name: str, style_name: str | None = None) -> dict:
    """在已有 datastore 上发布一个 PostGIS 表为 FeatureType。"""
    url = (
        f"{_base()}/workspaces/{_ws()}/datastores/"
        f"{settings.geoserver_datastore}/featuretypes"
    )
    payload = {
        "featureType": {
            "name": layer_name,
            "nativeName": table_name,
            "title": layer_name,
            "srs": "EPSG:4326",
        }
    }
    if style_name:
        payload["featureType"]["defaultStyle"] = {"name": style_name}

    r = requests.post(url, json=payload, auth=_auth(), timeout=15)
    r.raise_for_status()
    return {"status": "created", "layer": layer_name}


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
    payload = {"layer": {"defaultStyle": {"name": style_name}}}
    r = requests.put(url, json=payload, auth=_auth(), timeout=10)
    r.raise_for_status()
    return {"status": "updated", "layer": layer_name, "style": style_name}

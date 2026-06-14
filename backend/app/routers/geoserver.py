from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.deps import require_api_key
from app.services import geoserver as gs

router = APIRouter(prefix="/geoserver", tags=["geoserver"])


class PublishRequest(BaseModel):
    layer_name: str
    table_name: str
    style_name: str | None = None
    cql_filter: str | None = None


class StyleRequest(BaseModel):
    style_name: str


@router.get("/layers")
def list_layers():
    try:
        return {"layers": gs.list_layers()}
    except Exception as e:
        raise HTTPException(502, f"GeoServer 请求失败: {e}")


@router.post("/layers", dependencies=[Depends(require_api_key)])
def publish_layer(body: PublishRequest):
    try:
        return gs.publish_layer(
            body.layer_name,
            body.table_name,
            body.style_name,
            body.cql_filter,
        )
    except Exception as e:
        raise HTTPException(502, f"发布图层失败: {e}")


@router.delete("/layers/{name}", dependencies=[Depends(require_api_key)])
def delete_layer(name: str):
    try:
        return gs.delete_layer(name)
    except Exception as e:
        raise HTTPException(502, f"删除图层失败: {e}")


@router.put("/layers/{name}/style", dependencies=[Depends(require_api_key)])
def set_style(name: str, body: StyleRequest):
    try:
        return gs.set_layer_style(name, body.style_name)
    except Exception as e:
        raise HTTPException(502, f"切换样式失败: {e}")

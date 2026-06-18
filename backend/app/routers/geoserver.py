from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.deps import require_api_key
from app.services import geoserver as gs

router = APIRouter(prefix="/geoserver", tags=["geoserver"])


class PublishRequest(BaseModel):
    layer_name: str
    table_name: str
    style_name: str | None = None
    cql_filter: str | None = None


class SpeciesGridRequest(BaseModel):
    layer_name: str
    species_key: int
    grid_size: float = 1.0
    month: int | None = Field(default=None, ge=1, le=12)
    year: int = 2024
    style_name: str | None = "grid_heatmap"


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


@router.post("/species-grid", dependencies=[Depends(require_api_key)])
def publish_species_grid(body: SpeciesGridRequest):
    try:
        return gs.publish_species_grid_layer(
            body.layer_name,
            body.species_key,
            body.grid_size,
            body.month,
            body.year,
            body.style_name,
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(502, f"发布物种网格图层失败: {e}")


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

from typing import Generator
from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session
from app.config import settings
from app.db import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """GeoServer 管控接口（发布/删除/改样式）鉴权。

    校验请求头 `X-API-Key` 是否与 settings.geoserver_api_key 一致。
    未配置密钥时（本地开发默认）放行，但启动日志/文档应提醒联调环境务必设置。
    """
    expected = settings.geoserver_api_key
    if not expected:
        return
    if x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少或错误的 X-API-Key",
        )

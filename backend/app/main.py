from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import occurrence, species, stats, geoserver

app = FastAPI(
    title="BirdScope API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(occurrence.router, prefix=API_PREFIX)
app.include_router(species.router, prefix=API_PREFIX)
app.include_router(stats.router, prefix=API_PREFIX)
app.include_router(geoserver.router, prefix=API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}

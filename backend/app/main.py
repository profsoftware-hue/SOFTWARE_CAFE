from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="API de Inventario y Ventas CCP Pereira",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/health", tags=["Health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.app_name}

    @app.on_event("startup")
    def on_startup() -> None:
        Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    return app


app = create_application()

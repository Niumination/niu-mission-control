"""Niu-MissionControl — App Factory (v3.0.0)

Usage:
    from app.main import create_app
    app = create_app()
    uvicorn.run(app)
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .core.config import Settings, get_settings
from .core.middleware import auth_rate_limit_middleware
from .db.database import init_db, close_db

logger = logging.getLogger("mission-control")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory."""
    cfg = settings or get_settings()

    app = FastAPI(
        title="Niu-MissionControl",
        version="3.0.0",
        docs_url="/docs" if cfg.debug else None,
        redoc_url="/redoc" if cfg.debug else None,
    )

    # ── Store settings on app ──────────────────────────────
    app.state.settings = cfg

    # ── Middleware ──────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.middleware("http")(auth_rate_limit_middleware)

    # ── Lifecycle ──────────────────────────────────────────
    @app.on_event("startup")
    async def on_startup():
        await init_db(cfg.database_url)
        logger.info("Mission Control v3.0.0 started — db: %s", cfg.database_url)

    @app.on_event("shutdown")
    async def on_shutdown():
        await close_db()
        logger.info("Mission Control shut down.")

    # ── Static files ───────────────────────────────────────
    static_dir = Path(__file__).parent.parent.parent / "dashboard"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    # ── Health check (always public) ───────────────────────
    @app.get("/health", tags=["system"])
    async def health():
        return {"status": "ok", "version": "3.0.0"}

    # ── Serve frontend ─────────────────────────────────────
    @app.get("/", response_class=HTMLResponse, tags=["system"])
    async def index():
        return FileResponse(str(static_dir / "index.html"))

    @app.get("/orb", response_class=HTMLResponse, tags=["system"])
    async def orb():
        return FileResponse(str(static_dir / "orb.html"))

    @app.get("/dashboard", response_class=HTMLResponse, tags=["system"])
    async def dashboard():
        return FileResponse(str(static_dir / "index.html"))

    # ── Include routers ────────────────────────────────────
    from .routers import system, ecosystem, agents, tasks, terminal
    from .routers import routines
    from .routers import telegram, artifacts, config, skills, cost, deploy, ws

    app.include_router(system.router)
    app.include_router(ecosystem.router)
    app.include_router(agents.router)
    app.include_router(tasks.router)
    app.include_router(terminal.router)
    app.include_router(routines.router)
    app.include_router(telegram.router)
    app.include_router(artifacts.router)
    app.include_router(config.router)
    app.include_router(skills.router)
    app.include_router(cost.router)
    app.include_router(deploy.router)
    app.include_router(ws.router)

    return app


# Module-level app for uvicorn
app = create_app()


if __name__ == "__main__":
    uvicorn.run(
        "app.main:create_app",
        factory=True,
        host="0.0.0.0",
        port=5200,
        reload=os.getenv("MC_DEBUG", "0") == "1",
    )

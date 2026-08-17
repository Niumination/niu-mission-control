"""Auth + Rate Limiting middleware (extracted from server.py)."""
from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request
from fastapi.responses import JSONResponse

# ── Rate limit store (in-memory, per-IP) ──────────────────
_rate_store: dict[str, list[float]] = defaultdict(list)
RATE_WINDOW = 60  # seconds


def _check_rate_limit(ip: str, max_rpm: int = 60) -> bool:
    now = time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if now - t < RATE_WINDOW]
    if len(_rate_store[ip]) >= max_rpm:
        return False
    _rate_store[ip].append(now)
    return True


# ── Public paths (exact match — NOT startswith) ────────────
PUBLIC_PREFIXES = ("/static", "/docs", "/openapi.json", "/redoc")
PUBLIC_EXACT = {"/", "/health", "/ws/swarm", "/ws/orb", "/orb", "/dashboard", "/aios", "/api/mc/skills/event"}


def _is_public(path: str) -> bool:
    return path in PUBLIC_EXACT or any(path.startswith(p) for p in PUBLIC_PREFIXES)


async def auth_rate_limit_middleware(request: Request, call_next):
    """Combined API key auth + per-IP rate limiting."""
    path = request.url.path

    if _is_public(path):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting
    from app.core.config import get_settings
    cfg = get_settings()
    if not _check_rate_limit(client_ip, cfg.rate_limit_rpm):
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded."},
        )

    # Auth (only if MC_API_KEY is set)
    if cfg.mc_api_key:
        key = request.headers.get("X-API-Key", "")
        if key != cfg.mc_api_key:
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized: invalid or missing X-API-Key header"},
            )

    return await call_next(request)

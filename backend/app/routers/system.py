"""System router — health, status, config, WAL."""
from __future__ import annotations

import os
import platform
from datetime import datetime

from fastapi import APIRouter

router = APIRouter(prefix="/api/mc", tags=["system"])


@router.get("/system")
async def system_health():
    """System info — uptime, OS, Python, disk."""
    return {
        "status": "ok",
        "version": "3.0.0",
        "python": platform.python_version(),
        "os": f"{platform.system()} {platform.release()}",
        "uptime": _get_uptime(),
        "timestamp": datetime.now().isoformat(),
    }


def _get_uptime() -> str:
    try:
        with open("/proc/uptime") as f:
            seconds = float(f.read().split()[0])
        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        return f"{days}d {hours}h"
    except (FileNotFoundError, ValueError):
        return "unknown"

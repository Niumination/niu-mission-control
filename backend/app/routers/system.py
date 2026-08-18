"""System router — health, status, config, WAL."""
from __future__ import annotations

import os
import platform
import shutil
from datetime import datetime

from fastapi import APIRouter

router = APIRouter(prefix="/api/mc", tags=["system"])


@router.get("/system")
async def system_health():
    """System info — uptime, OS, Python, disk, memory."""
    import psutil
    try:
        mem = psutil.virtual_memory()
        disk = shutil.disk_usage("/")
        return {
            "status": "ok",
            "version": "3.0.0",
            "python": platform.python_version(),
            "os": f"{platform.system()} {platform.release()}",
            "uptime": _get_uptime(),
            "timestamp": datetime.now().isoformat(),
            "memory": {
                "percent": mem.percent,
                "total_gb": round(mem.total / (1024**3), 2),
                "used_gb": round(mem.used / (1024**3), 2),
                "available_gb": round(mem.available / (1024**3), 2),
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
            },
        }
    except ImportError:
        return {
            "status": "ok",
            "version": "3.0.0",
            "python": platform.python_version(),
            "os": f"{platform.system()} {platform.release()}",
            "uptime": _get_uptime(),
            "timestamp": datetime.now().isoformat(),
            "memory": {"percent": 0, "total_gb": 0, "used_gb": 0, "available_gb": 0},
            "disk": {"total_gb": 0, "used_gb": 0, "free_gb": 0},
        }


def _get_uptime() -> str:
    try:
        with open("/proc/uptime") as f:
            seconds = float(f.read().split()[0])
        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        return f"{days}d {hours}h"
    except (FileNotFoundError, ValueError):
        import time
        return f"{int(time.time() - os.path.getmtime('/'))}s"

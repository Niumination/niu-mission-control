"""Routines router — migrasi dari server.py."""
from __future__ import annotations

import os
import sys

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter

router = APIRouter(prefix="/api/mc", tags=["routines"])

BRAIN = "/Users/zaryu/Desktop/Niumination/brain"


@router.get("/routines")
async def list_routines():
    """Daftar routine yang tersedia + status brain."""
    from datetime import datetime
    projects = []
    pdir = os.path.join(BRAIN, "projects")
    if os.path.isdir(pdir):
        for name in sorted(os.listdir(pdir)):
            sf = os.path.join(pdir, name, "status.md")
            if os.path.isfile(sf):
                try:
                    with open(sf) as f:
                        lines = [l for l in f.read().split("\n") if l.strip()]
                    status = ""
                    if "## Status Saat Ini" in lines:
                        idx = lines.index("## Status Saat Ini")
                        status = lines[idx + 1].strip()[:80] if idx + 1 < len(lines) else ""
                    projects.append({"name": name, "status": status})
                except Exception:
                    pass

    today = datetime.now().strftime("%Y-%m-%d")
    daily = os.path.join(BRAIN, "inbox", f"{today}-daily.md")
    capture_count = 0
    if os.path.isfile(daily):
        try:
            with open(daily) as f:
                capture_count = sum(1 for l in f if l.startswith("- ["))
        except Exception:
            pass

    return {
        "routines": ["rekap-harian", "morning-brief", "sync-proyek"],
        "projects": projects,
        "capture_today": capture_count,
        "brain_root": BRAIN,
    }


@router.post("/routine/run")
async def run_routine(payload: dict):
    """Trigger routine. Whitelist ketat."""
    name = payload.get("name")
    whitelist = {"rekap-harian", "morning-brief", "sync-proyek"}
    if name not in whitelist:
        return {"status": "error", "output": f"Routine '{name}' tidak dikenal. Tersedia: {sorted(whitelist)}"}
    return {"status": "started", "routine": name}

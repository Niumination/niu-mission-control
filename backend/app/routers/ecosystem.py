"""Ecosystem router — migrasi dari server.py."""
from __future__ import annotations

import os
import sys

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/mc", tags=["ecosystem"])

@router.get("/ecosystem")
async def ecosystem_overview(type: str = "all"):
    """Ecosystem overview."""
    try:
        from modules.ecosystem_scanner import scan_ecosystem
        return scan_ecosystem(type)
    except Exception as e:
        return {"error": str(e), "projects": []}

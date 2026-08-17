"""Hermes router — status, directive, WS sessions."""
from __future__ import annotations

import os
import sys
import json

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/mc", tags=["system"])

@router.get("/hermes")
async def hermes_status():
    """Hermes gateway status."""
    try:
        from modules.hermes_status import get_all
        return get_all()
    except Exception as e:
        return {"gateway": {"online": False, "error": str(e)}, "cron": {"count": 0, "jobs": []}}


@router.get("/directive")
async def directive():
    """Per-thread directive and context window usage."""
    try:
        hermes_data = json.loads(
            open(os.path.join(_root, "data", "hermes_config.json")).read()
        ) if os.path.exists(os.path.join(_root, "data", "hermes_config.json")) else {}

        threads = []
        for tid in ["1", "802", "803", "804", "1172"]:
            threads.append({
                "thread_id": tid,
                "name": {"1": "General", "802": "Research", "803": "Programmer", "804": "QA", "1172": "Creator"}.get(tid, tid),
                "directive": "No directive set",
                "model": "N/A",
                "context_used": 0,
                "context_max": 0,
            })

        return {"threads": threads}
    except Exception as e:
        return {"threads": [], "error": str(e)}


@router.get("/ws/sessions")
async def ws_sessions(limit: int = 50):
    """List WebSocket sessions."""
    return {"sessions": [], "count": 0}

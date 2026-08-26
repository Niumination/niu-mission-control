"""Skills router — migrasi dari server.py via skill_monitor."""

from __future__ import annotations

import asyncio
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Request

_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
if _root not in sys.path:
    sys.path.insert(0, _root)

router = APIRouter(prefix="/api/mc", tags=["skills"])
_thread_pool = ThreadPoolExecutor(max_workers=4)


def _get_skill_monitor():
    try:
        from modules import skill_monitor

        return skill_monitor
    except ImportError:
        return None


@router.get("/skills")
async def skill_list():
    """Get all skills from bank + latest event status."""
    sm = _get_skill_monitor()
    if not sm:
        return {"skills": [], "total": 0, "active": 0}
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_thread_pool, sm.get_all_skills)


@router.get("/skills/stats")
async def skill_stats():
    """Get usage frequency stats."""
    sm = _get_skill_monitor()
    if not sm:
        return {"stats": []}
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_thread_pool, sm.get_stats)


@router.get("/skills/stale")
async def skill_stale():
    """Get skills not loaded in >30 days."""
    sm = _get_skill_monitor()
    if not sm:
        return {"stale": [], "count": 0}
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_thread_pool, sm.get_stale)


@router.get("/skills/conflicts")
async def skill_conflicts():
    """Detect conflicting active skills."""
    sm = _get_skill_monitor()
    if not sm:
        return {"conflicts": [], "count": 0}
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_thread_pool, sm.get_conflicts)


@router.post("/skills/event")
async def skill_event(request: Request):
    """Record a skill event."""
    body = await request.json()
    sm = _get_skill_monitor()
    if sm and hasattr(sm, "record_event"):
        try:
            sm.record_event(
                body.get("skill_name", ""),
                body.get("agent", ""),
                body.get("event_type", "load"),
                body.get("metadata", {}),
            )
        except Exception:
            pass
    return {"status": "recorded"}

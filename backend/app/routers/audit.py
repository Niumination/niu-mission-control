"""Audit + Inspector router — L3 view endpoints."""
from __future__ import annotations

import os
import sys

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/mc", tags=["audit"])

async def _get_db():
    from app.db.database import get_db
    return await get_db()


@router.get("/audit")
async def audit_log(limit: int = 50, actor: str = None):
    """Get audit log entries."""
    db = await _get_db()
    if actor:
        cursor = await db.execute(
            "SELECT * FROM audit WHERE actor=? ORDER BY ts DESC LIMIT ?",
            (actor, limit),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM audit ORDER BY ts DESC LIMIT ?",
            (limit,),
        )
    rows = await cursor.fetchall()
    return {"entries": [dict(r) for r in rows], "count": len(rows)}


@router.get("/audit/{task_id}")
async def audit_for_task(task_id: str):
    """Get audit entries for a specific task."""
    db = await _get_db()
    cursor = await db.execute(
        "SELECT * FROM audit WHERE target=? ORDER BY ts DESC",
        (task_id,),
    )
    rows = await cursor.fetchall()
    return {"entries": [dict(r) for r in rows], "count": len(rows)}


@router.get("/events")
async def event_log(limit: int = 100, type_filter: str = None):
    """Get event log entries."""
    db = await _get_db()
    if type_filter:
        cursor = await db.execute(
            "SELECT * FROM events WHERE type=? ORDER BY ts DESC LIMIT ?",
            (type_filter, limit),
        )
    else:
        cursor = await db.execute(
            "SELECT * FROM events ORDER BY ts DESC LIMIT ?",
            (limit,),
        )
    rows = await cursor.fetchall()
    return {"events": [dict(r) for r in rows], "count": len(rows)}


@router.get("/task/{task_id}")
async def task_detail(task_id: str):
    """Get full task detail with events + audit + cost."""
    db = await _get_db()

    # Task
    cursor = await db.execute("SELECT * FROM tasks WHERE id=?", (task_id,))
    task_row = await cursor.fetchone()
    if not task_row:
        return {"error": "Task not found"}

    # Events
    cursor = await db.execute(
        "SELECT * FROM events WHERE payload LIKE ? ORDER BY ts",
        (f'%{task_id}%',),
    )
    events = [dict(r) for r in await cursor.fetchall()]

    # Audit
    cursor = await db.execute(
        "SELECT * FROM audit WHERE target=? ORDER BY ts",
        (task_id,),
    )
    audit = [dict(r) for r in await cursor.fetchall()]

    # Cost
    cursor = await db.execute(
        "SELECT * FROM cost WHERE task_id=?", (task_id,),
    )
    cost = [dict(r) for r in await cursor.fetchall()]

    return {
        "task": dict(task_row),
        "events": events,
        "audit": audit,
        "cost": cost,
    }

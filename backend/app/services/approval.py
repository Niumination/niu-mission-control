"""Approval gate — dangerous actions require explicit approval."""
from __future__ import annotations

from datetime import datetime

from app.db.database import get_db
from app.services.state_machine import TaskStatus, transition_task


# Actions that require approval before execution
DANGEROUS_ACTIONS = {
    "shell", "terminal", "deploy", "send_telegram", "wal_checkpoint",
    "delete", "restart", "migrate",
}


async def request_approval(task_id: str, action: str, details: str = None) -> dict:
    """Request approval for a dangerous action. Task moves to 'awaiting_approval'."""
    db = await get_db()
    now = datetime.now().isoformat()

    # Insert approval request
    await db.execute(
        "INSERT INTO audit (ts, actor, action, target, result) VALUES (?, ?, ?, ?, ?)",
        (now, "system", f"approval_request:{action}", task_id, details),
    )
    await db.commit()

    return {
        "task_id": task_id,
        "action": action,
        "status": "awaiting_approval",
        "message": f"Action '{action}' requires approval. POST /api/mc/approve/{task_id} to approve.",
    }


async def approve(task_id: str, approved_by: str = "user") -> dict:
    """Approve a pending action."""
    db = await get_db()
    now = datetime.now().isoformat()

    await db.execute(
        "INSERT INTO audit (ts, actor, action, target, result) VALUES (?, ?, ?, ?, ?)",
        (now, approved_by, "approved", task_id, "User approved"),
    )
    await db.commit()

    return {"task_id": task_id, "status": "approved", "by": approved_by}


async def reject(task_id: str, rejected_by: str = "user", reason: str = None) -> dict:
    """Reject a pending action."""
    db = await get_db()
    now = datetime.now().isoformat()

    await db.execute(
        "INSERT INTO audit (ts, actor, action, target, result) VALUES (?, ?, ?, ?, ?)",
        (now, rejected_by, "rejected", task_id, reason or "User rejected"),
    )
    await db.commit()

    return {"task_id": task_id, "status": "rejected", "by": rejected_by}

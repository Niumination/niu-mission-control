"""Task state machine — validates transitions, persists state, emits events."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from app.db.database import get_db


class TaskStatus(str, Enum):
    QUEUED = "queued"
    DELEGATED = "delegated"
    RUNNING = "running"
    REVIEW = "review"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ── Valid transitions ──────────────────────────────────────
TRANSITIONS = {
    TaskStatus.QUEUED: [TaskStatus.DELEGATED, TaskStatus.CANCELLED],
    TaskStatus.DELEGATED: [TaskStatus.RUNNING, TaskStatus.FAILED, TaskStatus.CANCELLED],
    TaskStatus.RUNNING: [TaskStatus.REVIEW, TaskStatus.DONE, TaskStatus.FAILED],
    TaskStatus.REVIEW: [TaskStatus.DONE, TaskStatus.RUNNING, TaskStatus.FAILED],
    TaskStatus.DONE: [],  # terminal
    TaskStatus.FAILED: [TaskStatus.QUEUED],  # retry
    TaskStatus.CANCELLED: [TaskStatus.QUEUED],  # uncancel
}


async def transition_task(
    task_id: str, new_status: TaskStatus, result: str = None
) -> dict:
    """Validate and apply task status transition."""
    db = await get_db()
    cursor = await db.execute("SELECT status FROM tasks WHERE id=?", (task_id,))
    row = await cursor.fetchone()
    if not row:
        raise ValueError(f"Task {task_id} not found")

    current = TaskStatus(row["status"])
    if new_status not in TRANSITIONS.get(current, []):
        raise ValueError(f"Invalid transition: {current.value} → {new_status.value}")

    now = datetime.now().isoformat()
    await db.execute(
        "UPDATE tasks SET status=?, updated_at=? WHERE id=?",
        (new_status.value, now, task_id),
    )

    # Append event for replay
    await db.execute(
        "INSERT INTO events (type, payload, source) VALUES (?, ?, ?)",
        (
            "task.transition",
            f'{{"task_id":"{task_id}","from":"{current.value}","to":"{new_status.value}"}}',
            "state_machine",
        ),
    )

    # Append audit
    await db.execute(
        "INSERT INTO audit (actor, action, target, result) VALUES (?, ?, ?, ?)",
        ("system", f"transition:{current.value}→{new_status.value}", task_id, result),
    )

    await db.commit()
    return {"task_id": task_id, "from": current.value, "to": new_status.value}

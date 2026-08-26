"""Task service — business logic for task management."""

from __future__ import annotations

import uuid
from datetime import datetime

from app.db.database import get_db


async def get_kanban() -> dict:
    """Get tasks organized by status (kanban columns)."""
    db = await get_db()
    cursor = await db.execute("SELECT * FROM tasks ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    tasks = [dict(r) for r in rows]

    kanban = {"queued": [], "running": [], "review": [], "done": [], "failed": []}
    for t in tasks:
        status = t.get("status", "queued")
        if status in kanban:
            kanban[status].append(t)

    return {"tasks": tasks, "kanban": kanban, "total": len(tasks)}


async def create_task(title: str, agent: str = None, priority: str = "normal") -> dict:
    """Create a new task."""
    db = await get_db()
    task_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    await db.execute(
        "INSERT INTO tasks (id, title, agent, status, priority, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (task_id, title, agent, "queued", priority, now, now),
    )
    await db.commit()
    return {"id": task_id, "title": title, "status": "queued"}


async def update_task(task_id: str, status: str = None, title: str = None) -> dict:
    """Update a task."""
    db = await get_db()
    now = datetime.now().isoformat()
    if status:
        await db.execute(
            "UPDATE tasks SET status=?, updated_at=? WHERE id=?", (status, now, task_id)
        )
    if title:
        await db.execute(
            "UPDATE tasks SET title=?, updated_at=? WHERE id=?", (title, now, task_id)
        )
    await db.commit()
    return {"id": task_id, "updated": True}

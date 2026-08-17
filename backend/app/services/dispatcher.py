"""Dispatcher — SQLite-backed queue with claim/execute/ack pattern."""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime

from app.db.database import get_db
from app.services.state_machine import TaskStatus, transition_task


class Dispatcher:
    """Persistent task dispatcher backed by SQLite.

    Flow: create task → claim → execute (via adapter) → ack/nack → done/failed
    """

    def __init__(self, agent_adapters: dict = None):
        self.adapters = agent_adapters or {}
        self._running = False
        self._worker_task = None

    async def submit(self, title: str, agent: str = None, instruction: str = None) -> dict:
        """Submit a new task to the queue."""
        db = await get_db()
        task_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()

        await db.execute(
            "INSERT INTO tasks (id, title, agent, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (task_id, title, agent, TaskStatus.QUEUED.value, "normal", now, now),
        )
        await db.execute(
            "INSERT INTO events (type, payload, source) VALUES (?, ?, ?)",
            ("task.created", json.dumps({"task_id": task_id, "title": title, "agent": agent}), "dispatcher"),
        )
        await db.commit()
        return {"task_id": task_id, "status": "queued"}

    async def claim(self, task_id: str) -> dict:
        """Claim a task for execution (queued → delegated)."""
        return await transition_task(task_id, TaskStatus.DELEGATED)

    async def ack(self, task_id: str, result: str = None) -> dict:
        """Acknowledge successful execution (running → done)."""
        return await transition_task(task_id, TaskStatus.DONE, result)

    async def nack(self, task_id: str, error: str = None) -> dict:
        """Nack failed execution (running → failed)."""
        return await transition_task(task_id, TaskStatus.FAILED, error)

    async def cancel(self, task_id: str) -> dict:
        """Cancel a task."""
        return await transition_task(task_id, TaskStatus.CANCELLED)

    async def get_queue(self, status: str = None) -> list[dict]:
        """Get tasks, optionally filtered by status."""
        db = await get_db()
        if status:
            cursor = await db.execute("SELECT * FROM tasks WHERE status=? ORDER BY created_at DESC", (status,))
        else:
            cursor = await db.execute("SELECT * FROM tasks ORDER BY created_at DESC")
        return [dict(row) for row in await cursor.fetchall()]


# ── Singleton ──────────────────────────────────────────────
_dispatcher: Dispatcher | None = None


def get_dispatcher() -> Dispatcher:
    global _dispatcher
    if _dispatcher is None:
        _dispatcher = Dispatcher()
    return _dispatcher

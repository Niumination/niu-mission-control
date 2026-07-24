"""
SwarmBus — Inter-Agent Communication Layer
Berdasarkan spesifikasi NotebookLM "mission-control" (24 Jul 2026)

Menggunakan:
- SQLite WAL mode (persistence & state management, ramah USB)
- asyncio.Queue (in-memory communication antar agent)
- RAM Disk /tmp untuk temporary file (cegah USB wear)
"""

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, Optional
import aiosqlite

# Path ke SQLite — di storage target (USB/disk)
# Untuk dev, simpan di data/ relatif ke project root
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "swarm_state.db")

# RAM disk untuk temporary log & spec (macOS: /tmp)
TMP_RESEARCH = "/tmp/hermes_research"
TMP_QA = "/tmp/hermes_qa"

logger = logging.getLogger("swarm.bus")


class SwarmBus:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self.queues: Dict[str, asyncio.Queue] = {
            "chief": asyncio.Queue(),
            "research": asyncio.Queue(),
            "programmer": asyncio.Queue(),
            "qa": asyncio.Queue(),
        }
        self._db: Optional[aiosqlite.Connection] = None

    async def init_db(self):
        """Inisialisasi tabel dan optimasi PRAGMA SQLite WAL."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        os.makedirs(TMP_RESEARCH, exist_ok=True)
        os.makedirs(TMP_QA, exist_ok=True)

        self._db = await aiosqlite.connect(self.db_path)
        # Optimasi WAL untuk USB portable
        await self._db.execute("PRAGMA journal_mode = WAL;")
        await self._db.execute("PRAGMA synchronous = NORMAL;")
        await self._db.execute("PRAGMA busy_timeout = 5000;")
        await self._db.execute("PRAGMA temp_store = MEMORY;")

        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                parent_id TEXT,
                assigned_agent TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
                payload JSON,
                result JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS agent_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(task_id)
            )
            """
        )
        await self._db.commit()
        logger.info("SwarmBus DB initialized (WAL mode) at %s", self.db_path)

    async def create_task(
        self, agent: str, payload: Dict[str, Any], parent_id: str = None
    ) -> str:
        """Chief membuat task baru & mendistribusikannya ke queue agent."""
        task_id = str(uuid.uuid4())[:8]
        await self._db.execute(
            """
            INSERT INTO tasks (task_id, parent_id, assigned_agent, status, payload)
            VALUES (?, ?, ?, ?, ?)
            """,
            (task_id, parent_id, agent, "pending", json.dumps(payload)),
        )
        await self._db.commit()
        await self.queues[agent].put(task_id)
        logger.info("Task %s created for agent %s", task_id, agent)
        return task_id

    async def update_task_status(
        self, task_id: str, status: str, result: Dict[str, Any] = None
    ):
        """Agent memperbarui status & membagikan output (Blueprint/Log)."""
        await self._db.execute(
            "UPDATE tasks SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?",
            (status, json.dumps(result) if result else None, task_id),
        )
        await self._db.commit()

    async def log_event(self, task_id: str, agent_id: str, level: str, message: str):
        """Menulis log peristiwa dari agent ke DB (untuk dikonsumsi Dashboard)."""
        await self._db.execute(
            """
            INSERT INTO agent_logs (task_id, agent_id, level, message)
            VALUES (?, ?, ?, ?)
            """,
            (task_id, agent_id, level, message),
        )
        await self._db.commit()

    async def get_agent_logs(self, agent_id: str = None, limit: int = 50) -> list:
        """Ambil log terbaru untuk dashboard feed."""
        if agent_id:
            async with self._db.execute(
                """
                SELECT task_id, agent_id, level, message, timestamp
                FROM agent_logs WHERE agent_id = ?
                ORDER BY log_id DESC LIMIT ?
                """,
                (agent_id, limit),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with self._db.execute(
                """
                SELECT task_id, agent_id, level, message, timestamp
                FROM agent_logs ORDER BY log_id DESC LIMIT ?
                """,
                (limit,),
            ) as cursor:
                rows = await cursor.fetchall()
        return [
            {
                "task_id": r[0],
                "agent_id": r[1],
                "level": r[2],
                "message": r[3],
                "timestamp": r[4],
            }
            for r in rows
        ]

    async def get_tasks(self, status: str = None) -> list:
        """Ambil daftar task untuk Kanban board."""
        if status:
            async with self._db.execute(
                """
                SELECT task_id, assigned_agent, status, payload, result, created_at
                FROM tasks WHERE status = ? ORDER BY created_at DESC
                """,
                (status,),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with self._db.execute(
                """
                SELECT task_id, assigned_agent, status, payload, result, created_at
                FROM tasks ORDER BY created_at DESC LIMIT 100
                """,
                (),
            ) as cursor:
                rows = await cursor.fetchall()
        return [
            {
                "task_id": r[0],
                "agent": r[1],
                "status": r[2],
                "payload": json.loads(r[3]) if r[3] else {},
                "result": json.loads(r[4]) if r[4] else None,
                "created_at": r[5],
            }
            for r in rows
        ]

    async def close(self):
        if self._db:
            await self._db.close()


# Singleton instance
bus = SwarmBus()

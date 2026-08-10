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
            "creator": asyncio.Queue(),
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
            CREATE TABLE IF NOT EXISTS cost_tracking (
                cost_id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                model TEXT,
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                cost_usd REAL DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(task_id) REFERENCES tasks(task_id)
            )
            """
        )
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS artifact_versions (
                version_id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                hash TEXT NOT NULL,
                task_id TEXT,
                agent_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(file_path, hash)
            )
            """
        )
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS ws_sessions (
                session_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                message_count INTEGER DEFAULT 0,
                is_recording BOOLEAN DEFAULT 0
            )
            """
        )
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS ws_messages (
                msg_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                direction TEXT NOT NULL CHECK(direction IN ('sent', 'received')),
                message_type TEXT,
                payload TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES ws_sessions(session_id)
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

    # ── Cost Tracking ────────────────────────────────────

    async def record_cost(
        self,
        task_id: str,
        agent_id: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        cost_usd: float,
    ):
        """Record token usage and cost for a task."""
        total_tokens = prompt_tokens + completion_tokens
        await self._db.execute(
            """
            INSERT INTO cost_tracking (task_id, agent_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (task_id, agent_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd),
        )
        await self._db.commit()

    async def get_task_cost(self, task_id: str) -> dict:
        """Get cost breakdown for a specific task."""
        async with self._db.execute(
            """
            SELECT model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at
            FROM cost_tracking WHERE task_id = ? ORDER BY created_at
            """,
            (task_id,),
        ) as cursor:
            rows = await cursor.fetchall()

        if not rows:
            return {"total_cost": 0.0, "total_tokens": 0, "entries": []}

        total_cost = sum(r[4] for r in rows)
        total_tokens = sum(r[3] for r in rows)
        entries = [
            {
                "model": r[0],
                "prompt_tokens": r[1],
                "completion_tokens": r[2],
                "total_tokens": r[3],
                "cost_usd": r[4],
                "timestamp": r[5],
            }
            for r in rows
        ]
        return {"total_cost": total_cost, "total_tokens": total_tokens, "entries": entries}

    async def get_agent_costs(self, agent_id: str = None, days: int = 30) -> dict:
        """Get aggregated cost per agent over N days."""
        if agent_id:
            async with self._db.execute(
                """
                SELECT agent_id, model, SUM(prompt_tokens), SUM(completion_tokens), SUM(total_tokens), SUM(cost_usd), COUNT(*)
                FROM cost_tracking
                WHERE agent_id = ? AND created_at > datetime('now', ?)
                GROUP BY agent_id, model
                """,
                (agent_id, f"-{days} days"),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with self._db.execute(
                """
                SELECT agent_id, model, SUM(prompt_tokens), SUM(completion_tokens), SUM(total_tokens), SUM(cost_usd), COUNT(*)
                FROM cost_tracking
                WHERE created_at > datetime('now', ?)
                GROUP BY agent_id, model
                """,
                (f"-{days} days",),
            ) as cursor:
                rows = await cursor.fetchall()

        agents = {}
        total_cost = 0.0
        total_tokens = 0
        total_requests = 0

        for r in rows:
            agent = r[0]
            if agent not in agents:
                agents[agent] = {"models": {}, "total_cost": 0.0, "total_tokens": 0, "requests": 0}

            agents[agent]["models"][r[1]] = {
                "prompt_tokens": r[2],
                "completion_tokens": r[3],
                "total_tokens": r[4],
                "cost_usd": r[5],
                "requests": r[6],
            }
            agents[agent]["total_cost"] += r[5]
            agents[agent]["total_tokens"] += r[4]
            agents[agent]["requests"] += r[6]
            total_cost += r[5]
            total_tokens += r[4]
            total_requests += r[6]

        return {
            "agents": agents,
            "total_cost": total_cost,
            "total_tokens": total_tokens,
            "total_requests": total_requests,
            "period_days": days,
        }

    async def get_cost_summary(self) -> dict:
        """Get overall cost summary for dashboard."""
        async with self._db.execute(
            """
            SELECT SUM(cost_usd), SUM(total_tokens), COUNT(*), COUNT(DISTINCT task_id)
            FROM cost_tracking
            """
        ) as cursor:
            row = await cursor.fetchone()

        return {
            "total_cost_usd": row[0] or 0.0,
            "total_tokens": row[1] or 0,
            "total_requests": row[2] or 0,
            "total_tasks_with_cost": row[3] or 0,
        }

    # ── Artifact Versioning & Diff ────────────────────────

    async def record_artifact_version(
        self,
        file_path: str,
        content: str,
        task_id: str = None,
        agent_id: str = None,
    ) -> str:
        """Record a new version of an artifact file. Returns the hash."""
        import hashlib
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]

        try:
            await self._db.execute(
                """
                INSERT OR IGNORE INTO artifact_versions (file_path, content, hash, task_id, agent_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (file_path, content, content_hash, task_id, agent_id),
            )
            await self._db.commit()
        except Exception:
            pass  # Ignore duplicates

        return content_hash

    async def get_artifact_versions(self, file_path: str, limit: int = 50) -> list:
        """Get all versions of an artifact file."""
        async with self._db.execute(
            """
            SELECT version_id, hash, task_id, agent_id, created_at, LENGTH(content) as size
            FROM artifact_versions
            WHERE file_path = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (file_path, limit),
        ) as cursor:
            rows = await cursor.fetchall()

        return [
            {
                "version_id": r[0],
                "hash": r[1],
                "task_id": r[2],
                "agent_id": r[3],
                "created_at": r[4],
                "size": r[5],
            }
            for r in rows
        ]

    async def get_artifact_version_content(self, version_id: int) -> str:
        """Get content of a specific artifact version."""
        async with self._db.execute(
            "SELECT content FROM artifact_versions WHERE version_id = ?",
            (version_id,),
        ) as cursor:
            row = await cursor.fetchone()
        return row[0] if row else ""

    async def get_artifact_diff(self, file_path: str, from_version: int, to_version: int) -> dict:
        """Get diff between two versions of an artifact."""
        from_content = await self.get_artifact_version_content(from_version)
        to_content = await self.get_artifact_version_content(to_version)

        if not from_content or not to_content:
            return {"error": "Version not found"}

        diff = self._compute_diff(from_content, to_content)
        return {
            "file_path": file_path,
            "from_version": from_version,
            "to_version": to_version,
            "diff": diff,
        }

    def _compute_diff(self, old_text: str, new_text: str) -> list:
        """Compute line-by-line diff (simple Myers-like algorithm)."""
        import difflib
        old_lines = old_text.splitlines(keepends=True)
        new_lines = new_text.splitlines(keepends=True)

        diff = difflib.unified_diff(old_lines, new_lines, lineterm="", n=3)
        diff_lines = list(diff)[2:]  # Skip header lines

        result = []
        for line in diff_lines:
            if line.startswith("+"):
                result.append({"type": "add", "content": line[1:]})
            elif line.startswith("-"):
                result.append({"type": "remove", "content": line[1:]})
            else:
                result.append({"type": "context", "content": line[1:] if line.startswith(" ") else line})
        return result

    # ── WebSocket Session Recording ────────────────────────

    async def start_ws_session(self, name: str = None) -> int:
        """Start a new WebSocket recording session. Returns session_id."""
        import time
        session_name = name or f"ws_session_{int(time.time())}"
        async with self._db.execute(
            """
            INSERT INTO ws_sessions (name, is_recording) VALUES (?, 1)
            """,
            (session_name,),
        ) as cursor:
            await self._db.commit()
            return cursor.lastrowid

    async def stop_ws_session(self, session_id: int):
        """Stop a WebSocket recording session."""
        await self._db.execute(
            """
            UPDATE ws_sessions SET is_recording = 0, ended_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
            """,
            (session_id,),
        )
        await self._db.commit()

    async def record_ws_message(
        self,
        session_id: int,
        direction: str,
        message_type: str,
        payload: str,
    ):
        """Record a WebSocket message (sent or received)."""
        if not session_id:
            return
        await self._db.execute(
            """
            INSERT INTO ws_messages (session_id, direction, message_type, payload)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, direction, message_type, payload),
        )
        await self._db.execute(
            """
            UPDATE ws_sessions SET message_count = message_count + 1
            WHERE session_id = ?
            """,
            (session_id,),
        )
        await self._db.commit()

    async def get_ws_sessions(self, limit: int = 50) -> list:
        """Get list of recorded WebSocket sessions."""
        async with self._db.execute(
            """
            SELECT session_id, name, started_at, ended_at, message_count, is_recording
            FROM ws_sessions
            ORDER BY started_at DESC
            LIMIT ?
            """,
            (limit,),
        ) as cursor:
            rows = await cursor.fetchall()

        return [
            {
                "session_id": r[0],
                "name": r[1],
                "started_at": r[2],
                "ended_at": r[3],
                "message_count": r[4],
                "is_recording": bool(r[5]),
            }
            for r in rows
        ]

    async def get_ws_session_messages(self, session_id: int) -> list:
        """Get all messages for a WebSocket session."""
        async with self._db.execute(
            """
            SELECT msg_id, direction, message_type, payload, timestamp
            FROM ws_messages
            WHERE session_id = ?
            ORDER BY msg_id ASC
            """,
            (session_id,),
        ) as cursor:
            rows = await cursor.fetchall()

        return [
            {
                "msg_id": r[0],
                "direction": r[1],
                "message_type": r[2],
                "payload": r[3],
                "timestamp": r[4],
            }
            for r in rows
        ]

    async def delete_ws_session(self, session_id: int):
        """Delete a WebSocket session and its messages."""
        await self._db.execute("DELETE FROM ws_messages WHERE session_id = ?", (session_id,))
        await self._db.execute("DELETE FROM ws_sessions WHERE session_id = ?", (session_id,))
        await self._db.commit()

    async def close(self):
        if self._db:
            await self._db.close()

    async def health_check(self):
        """Quick database connectivity check for health endpoint."""
        if not self._db:
            raise RuntimeError("Database not initialized")
        # Simple query to verify DB is responsive
        await self._db.execute("SELECT 1")
        await self._db.commit()


# Singleton instance
bus = SwarmBus()

"""
Telegram Feed Parser — Read real Telegram conversations from Hermes state.db
=============================================================================

Membaca database SQLite Hermes (state.db) untuk menampilkan percakapan
Telegram nyata di dashboard MC. Sebelumnya gateway.log hanya punya metadata
(char count, timing), tapi isi pesan aktual ada di state.db messages table.

Alur data:
  Hermes state.db (sessions + messages) → parser → /api/mc/telegram-feed
"""

from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger("gateway_log_parser")

# Default path ke Hermes state.db
HERMES_DATA_DIR = os.environ.get(
    "HERMES_DATA_DIR",
    "/Volumes/HermesAgent/HermesAgentUSB/data",
)
STATE_DB = os.path.join(HERMES_DATA_DIR, "state.db")

# Fallback: coba path lain
STATE_DB_CANDIDATES = [
    STATE_DB,
    os.path.expanduser("~/.hermes/state.db"),
    os.path.expanduser("~/.hermes-portable/state.db"),
]

# Chat ID Telegram group
TG_GROUP_CHAT_ID = "-1004204696417"

# Topic ID → Agent mapping
TOPIC_AGENT_MAP = {
    None: "general",
    "": "general",
    "None": "general",
    "1": "general",
    "802": "research",
    "803": "programmer",
    "804": "qa",
}


def _find_state_db() -> Optional[str]:
    """Cari state.db di beberapa lokasi."""
    for path in STATE_DB_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def _truncate(text: str, max_len: int = 500) -> str:
    """Truncate panjang pesan untuk display."""
    if not text:
        return ""
    # Hapus whitespace berlebih
    text = " ".join(text.split())
    if len(text) <= max_len:
        return text
    return text[:max_len] + "..."


def _clean_user_message(content: str) -> str:
    """Bersihkan user message dari prefix [Afrizal Munthe] jika ada."""
    if content.startswith("[") and "] " in content:
        # "[Afrizal Munthe] halo" → "halo"
        return content.split("] ", 1)[1]
    return content


def _is_useful_message(role: str, content: str) -> bool:
    """Filter pesan yang berguna (skip tool calls, context compaction, dll)."""
    if not content or not content.strip():
        return False
    if role == "tool":
        return False
    if "[CONTEXT COMPACTION" in content:
        return False
    if content.startswith("<untrusted_tool_result"):
        return False
    if role == "assistant" and len(content.strip()) < 3:
        return False
    return True


def parse_telegram_feed(
    db_path: Optional[str] = None,
    limit: int = 50,
    topic_filter: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    Baca percakapan Telegram dari Hermes state.db.

    Args:
        db_path: Path ke state.db (default: auto-detect)
        limit: Jumlah pesan maksimal
        topic_filter: Filter by topic/thread ID ("1", "802", "803", "804") atau None

    Returns:
        List of message dicts:
        {
            "timestamp": "2026-07-25 18:13:07",
            "type": "user" | "assistant",
            "user": "Afrizal Munthe",
            "message": "periksa kondisi ekosistem proyek saat ini",
            "topic_id": "1",
            "topic_label": "General",
            "agent": "general",
        }
    """
    path = db_path or _find_state_db()
    if not path or not os.path.exists(path):
        logger.warning("Hermes state.db not found")
        return []

    events: list[dict[str, Any]] = []

    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row

        # Query: ambil user dan assistant messages dari group chat
        # Join messages dengan sessions untuk dapat thread_id (topic)
        query = """
            SELECT
                m.role,
                m.content,
                m.timestamp,
                s.thread_id,
                s.title as session_title
            FROM messages m
            JOIN sessions s ON m.session_id = s.id
            WHERE s.chat_id = ?
              AND m.role IN ('user', 'assistant')
              AND m.content IS NOT NULL
              AND m.compacted = 0
            ORDER BY m.timestamp DESC
            LIMIT ?
        """

        # Ambil lebih banyak karena kita filter di Python
        fetch_limit = limit * 3
        cursor = conn.execute(query, (TG_GROUP_CHAT_ID, fetch_limit))
        rows = cursor.fetchall()

        for row in rows:
            role = row["role"]
            content = row["content"]
            timestamp_unix = row["timestamp"]
            thread_id = row["thread_id"]

            # Filter pesan yang tidak berguna
            if not _is_useful_message(role, content):
                continue

            # Convert timestamp
            try:
                dt = datetime.fromtimestamp(timestamp_unix)
                timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                timestamp = str(timestamp_unix)

            # Determine topic
            topic_id = str(thread_id) if thread_id else "1"
            agent = TOPIC_AGENT_MAP.get(topic_id, "general")

            # Apply topic filter
            if topic_filter:
                if topic_filter == "1":
                    if topic_id not in ("1", "None", "NoneType", ""):
                        continue
                elif topic_id != topic_filter:
                    continue

            # Extract user name for user messages
            user = ""
            message = content
            if role == "user":
                # "[Afrizal Munthe] halo" → user="Afrizal Munthe", message="halo"
                if content.startswith("[") and "] " in content:
                    user = content[1:content.index("]")]
                    message = _clean_user_message(content)
                else:
                    user = "User"

            events.append({
                "timestamp": timestamp,
                "type": role,
                "user": user,
                "message": _truncate(message),
                "topic_id": topic_id,
                "topic_label": agent.title(),
                "agent": agent,
                "session_title": row["session_title"] or "",
            })

        conn.close()

    except Exception as e:
        logger.error("Error reading Hermes state.db: %s", e)
        return []

    # Kita sudah ORDER BY timestamp DESC, tapi events terisi dari belakang
    # Reverse untuk chronological order (oldest first)
    events.reverse()

    # Apply limit
    if len(events) > limit:
        events = events[-limit:]

    return events


def get_gateway_status() -> dict[str, Any]:
    """Return info tentang data source untuk debugging."""
    db_path = _find_state_db()
    exists = db_path is not None
    size_kb = 0
    if exists and db_path:
        try:
            size_kb = round(os.path.getsize(db_path) / 1024, 1)
        except Exception:
            pass

    # Count total messages in group chat
    total_messages = 0
    if exists and db_path:
        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            cursor = conn.execute(
                "SELECT COUNT(*) FROM messages m JOIN sessions s ON m.session_id = s.id "
                "WHERE s.chat_id = ? AND m.role IN ('user', 'assistant') AND m.compacted = 0",
                (TG_GROUP_CHAT_ID,),
            )
            total_messages = cursor.fetchone()[0]
            conn.close()
        except Exception:
            pass

    return {
        "source": "hermes_state_db",
        "db_path": db_path or "not found",
        "exists": exists,
        "size_kb": size_kb,
        "group_chat_id": TG_GROUP_CHAT_ID,
        "total_group_messages": total_messages,
    }

"""Database layer — aiosqlite + repository pattern."""
from __future__ import annotations

import logging
from pathlib import Path

import aiosqlite

logger = logging.getLogger("mission-control.db")

_db: aiosqlite.Connection | None = None


async def init_db(database_url: str) -> None:
    """Initialize SQLite database connection + WAL mode."""
    global _db
    # Extract path from sqlite+aiosqlite:///path
    db_path = database_url.split("///")[-1] if "///" in database_url else database_url
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    _db = await aiosqlite.connect(db_path)
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA foreign_keys=ON")

    # Create schema if not exists
    await _create_tables(_db)
    logger.info("Database initialized: %s (WAL mode)", db_path)


async def get_db() -> aiosqlite.Connection:
    """Get active database connection."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def close_db() -> None:
    """Close database connection."""
    global _db
    if _db:
        await _db.close()
        _db = None
        logger.info("Database closed.")


async def _create_tables(db: aiosqlite.Connection) -> None:
    """Create tables if they don't exist."""
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            agent TEXT,
            status TEXT DEFAULT 'queued',
            priority TEXT DEFAULT 'normal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type TEXT NOT NULL,
            payload TEXT,
            source TEXT DEFAULT 'system'
        );

        CREATE TABLE IF NOT EXISTS dispatches (
            id TEXT PRIMARY KEY,
            task_id TEXT,
            agent TEXT,
            command TEXT,
            status TEXT DEFAULT 'pending',
            result TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            target TEXT,
            result TEXT
        );

        CREATE TABLE IF NOT EXISTS cost (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            agent TEXT,
            model TEXT,
            tokens_in INTEGER DEFAULT 0,
            tokens_out INTEGER DEFAULT 0,
            cost_usd REAL DEFAULT 0.0,
            task_id TEXT
        );
    """)
    await db.commit()

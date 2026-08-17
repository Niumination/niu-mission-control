#!/usr/bin/env python3
"""Migrate data from JSON files to SQLite (v3 database).

Usage:
    cd services/niu-mission-control
    python3 backend/scripts/migrate_data.py [--dry-run]

What it migrates:
    - data/dispatches.json → dispatches table
    - data/swarm_config.json → config table
    - Existing mission_control.db preserved (schema upgrade if needed)
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


def migrate_dispatches(conn: sqlite3.Connection, data_dir: Path, dry_run: bool = False):
    """Migrate dispatches.json → dispatches table."""
    dispatches_file = data_dir / "dispatches.json"
    if not dispatches_file.exists():
        print("  ℹ️  dispatches.json tidak ada — skip")
        return 0

    with open(dispatches_file) as f:
        records = json.load(f)

    count = 0
    for r in records:
        if dry_run:
            print(f"  [DRY] INSERT dispatch: {r.get('id', '?')} → {r.get('to_name', '?')}")
        else:
            conn.execute(
                "INSERT OR IGNORE INTO dispatches (id, task_id, agent, command, status, result, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    r.get("id", ""),
                    None,
                    r.get("to_name", r.get("to", "")),
                    r.get("message", ""),
                    "done" if r.get("status") == "completed" else "pending",
                    r.get("result", ""),
                    r.get("ts", datetime.now().isoformat()),
                    r.get("ts", None),
                ),
            )
        count += 1

    if not dry_run:
        conn.commit()
    print(f"  ✅ dispatches.json → {count} records migrasi")
    return count


def migrate_swarm_config(conn: sqlite3.Connection, data_dir: Path, dry_run: bool = False):
    """Migrate swarm_config.json → config table."""
    config_file = data_dir / "swarm_config.json"
    if not config_file.exists():
        print("  ℹ️  swarm_config.json tidak ada — skip")
        return

    with open(config_file) as f:
        config = json.load(f)

    if dry_run:
        print(f"  [DRY] INSERT config: {json.dumps(config, indent=2)[:200]}")
    else:
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)",
            ("swarm_config", json.dumps(config), datetime.now().isoformat()),
        )
        conn.commit()
    print("  ✅ swarm_config.json → config table")


def upgrade_schema(conn: sqlite3.Connection):
    """Add tables/columns if missing (idempotent)."""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    print("  ✅ Schema upgrade (idempotent)")


def main():
    parser = argparse.ArgumentParser(description="Migrate v2 data to v3 SQLite")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    data_dir = Path("data")
    db_path = data_dir / "mission_control.db"

    print("🔄 Niu-MissionControl v3 Data Migration")
    print(f"   Data dir: {data_dir}")
    print(f"   Database: {db_path}")
    print(f"   Dry run: {args.dry_run}")
    print()

    if not args.dry_run:
        # Backup existing DB
        if db_path.exists():
            backup = db_path.with_suffix(f".v2_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")
            shutil.copy2(db_path, backup)
            print(f"  📦 Backup: {backup}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    print("📋 Upgrading schema...")
    upgrade_schema(conn)

    print("📋 Migrating dispatches...")
    n = migrate_dispatches(conn, data_dir, args.dry_run)

    print("📋 Migrating swarm config...")
    migrate_swarm_config(conn, data_dir, args.dry_run)

    conn.close()

    print()
    print("✅ Migrasi selesai!")
    if not args.dry_run:
        print(f"   Database: {db_path}")
        print(f"   Backup v2: {data_dir}/*.v2_backup_*.db")


if __name__ == "__main__":
    main()

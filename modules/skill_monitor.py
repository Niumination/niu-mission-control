"""
Skill Monitor — Layer 4 Skill Usage Tracker
============================================
Tracking, stats, stale detection, dan conflict detection
untuk semua skill di bank pusat Niumination.

API:
- POST /api/mc/skills/event  — agent report skill load/unload
- GET  /api/mc/skills        — all skills + latest status
- GET  /api/mc/skills/stats  — usage frequency & trending
- GET  /api/mc/skills/stale  — skill >30 hari tidak dipakai
- GET  /api/mc/skills/conflicts — konflik skill terdeteksi

v2.0 — Fix: permanent cache dihapus, auto-seed skills ke DB,
TTL 30s untuk performa, tidak ada skill yang hilang.
"""

import json
import logging
import os
import sqlite3
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger("skill-monitor")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "mission_control.db")

# Thresholds
STALE_DAYS = 30
CONFLICT_PAIRS = [
    ("ultrathink", "ponytail-core"),           # Craftsmanship vs Minimalism
    ("impeccable", "ui-ux-pro-max"),           # UI/UX Build vs Research
    ("systematic-debugging", "hermes-zero-defect-architect"),  # Debugging Generic vs Aggressive
]

# Skill bank cache with TTL
_skill_bank_cache: list[dict] | None = None
_skill_bank_cache_time: float = 0
SKILL_BANK_CACHE_TTL = 30  # detik, refresh dari disk setiap 30 detik

SKILL_CACHE_ACTIVE: dict[str, float] = {}  # skill_name -> last load timestamp


# ── Helpers ──────────────────────────────────────────────

def _get_home() -> str:
    """Get real user home dir — handles Hermes env where HOME != /Users/user.

    Cek folder skills/ (bukan cuma Desktop/Niumination) karena folder kosong
    bisa eksis di HOME cache (Hermes env) dan menyesatkan resolusi.
    """
    home = os.path.expanduser("~")
    if os.path.isdir(os.path.join(home, "Desktop", "Niumination", "skills")):
        return home
    user = os.environ.get("USER", "zaryu")
    alt = f"/Users/{user}"
    if os.path.isdir(os.path.join(alt, "Desktop", "Niumination", "skills")):
        return alt
    return home


# ── DB Init ──────────────────────────────────────────────

def init_db():
    """Create skill_events table if not exists, then auto-seed bank skills."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS skill_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            skill_name TEXT NOT NULL,
            agent TEXT NOT NULL DEFAULT 'unknown',
            event_type TEXT NOT NULL DEFAULT 'load',
            timestamp REAL NOT NULL,
            metadata TEXT DEFAULT '{}'
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_skill_events_name
        ON skill_events(skill_name)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_skill_events_ts
        ON skill_events(timestamp)
    """)
    conn.commit()
    conn.close()
    logger.info("Skill monitor DB initialized")

    # Auto-seed: ensure all skills from bank have at least one event
    _seed_all_skills()


# ── Bank Pusat Scanner (TTL-based, no permanent cache) ──

def _scan_skill_bank(force: bool = False) -> list[dict]:
    """Scan ~/Desktop/Niumination/skills/ — TTL cache 30s, refresh otomatis."""
    global _skill_bank_cache, _skill_bank_cache_time

    now = time.time()
    if not force and _skill_bank_cache is not None and (now - _skill_bank_cache_time) < SKILL_BANK_CACHE_TTL:
        return _skill_bank_cache

    home = _get_home()
    bank = os.path.join(home, "Desktop", "Niumination", "skills")
    skills = []
    if os.path.isdir(bank):
        for root, dirs, files in os.walk(bank):
            if "SKILL.md" in files:
                sk_path = os.path.join(root, "SKILL.md")
                rel = os.path.relpath(sk_path, bank)
                parts = rel.split("/")
                domain = parts[0] if len(parts) >= 3 else "unknown"
                skill_name = parts[1] if len(parts) >= 3 else parts[0]
                skills.append({
                    "name": skill_name,
                    "domain": domain,
                    "path": sk_path,
                })

    _skill_bank_cache = skills
    _skill_bank_cache_time = now
    logger.debug("Skill bank scanned: %d skills", len(skills))
    return skills


# ── Auto-Seed: all bank skills get a registration event in DB ──

def _seed_all_skills():
    """Ensure every skill from bank pusat has a 'seed' event in DB.
    This guarantees get_all_skills() always shows ALL skills,
    even if sync-to-agents.sh failed to POST events.
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        bank_skills = _scan_skill_bank(force=True)
        now = time.time()
        seeded = 0

        for sk in bank_skills:
            name = sk["name"]
            existing = conn.execute(
                "SELECT COUNT(*) FROM skill_events WHERE skill_name = ?",
                (name,),
            ).fetchone()[0]
            if existing == 0:
                conn.execute(
                    "INSERT INTO skill_events (skill_name, agent, event_type, timestamp, metadata) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (name, "system", "seed", now, json.dumps({"source": "auto-seed"})),
                )
                seeded += 1

        conn.commit()
        if seeded:
            logger.info("Auto-seeded %d new skills into DB", seeded)
    finally:
        conn.close()


# ── Event Recording ─────────────────────────────────────

def record_event(skill_name: str, agent: str = "unknown",
                 event_type: str = "load", metadata: dict = None) -> dict:
    """Record a skill load/unload event and return current status."""
    now = time.time()
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO skill_events (skill_name, agent, event_type, timestamp, metadata) "
        "VALUES (?, ?, ?, ?, ?)",
        (skill_name, agent, event_type, now, json.dumps(metadata or {})),
    )
    conn.commit()
    conn.close()

    # Update in-memory cache
    if event_type == "load":
        SKILL_CACHE_ACTIVE[skill_name] = now
    elif event_type == "unload" and skill_name in SKILL_CACHE_ACTIVE:
        del SKILL_CACHE_ACTIVE[skill_name]

    logger.info("Skill %s: %s by %s", event_type, skill_name, agent)
    return {"status": "recorded", "skill": skill_name, "event": event_type}


# ── Stats ────────────────────────────────────────────────

def get_all_skills():
    """Get all skills from bank + latest event status.
    Auto-refresh bank scan setiap 30s. Tidak ada permanent cache.
    """
    bank_skills = _scan_skill_bank()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    results = []
    for sk in bank_skills:
        name = sk["name"]
        row = conn.execute(
            "SELECT event_type, timestamp, agent FROM skill_events "
            "WHERE skill_name = ? ORDER BY timestamp DESC LIMIT 1",
            (name,),
        ).fetchone()

        count_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM skill_events "
            "WHERE skill_name = ? AND event_type = 'load'",
            (name,),
        ).fetchone()

        active = name in SKILL_CACHE_ACTIVE
        results.append({
            "name": name,
            "domain": sk["domain"],
            "active": active,
            "last_event": row["event_type"] if row else "seed",
            "last_timestamp": row["timestamp"] if row else None,
            "last_agent": row["agent"] if row else "system",
            "load_count": count_row["cnt"] if count_row else 0,
        })

    conn.close()
    return {"skills": results, "total": len(results), "active": len(SKILL_CACHE_ACTIVE)}


def get_stats():
    """Get usage frequency stats for all skills."""
    bank_skills = _scan_skill_bank()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    today_start = time.mktime(datetime.now().replace(hour=0, minute=0, second=0).timetuple())
    week_start = today_start - 7 * 86400

    stats = []
    for sk in bank_skills:
        name = sk["name"]
        today = conn.execute(
            "SELECT COUNT(*) as cnt FROM skill_events "
            "WHERE skill_name = ? AND event_type = 'load' AND timestamp >= ?",
            (name, today_start),
        ).fetchone()["cnt"]

        this_week = conn.execute(
            "SELECT COUNT(*) as cnt FROM skill_events "
            "WHERE skill_name = ? AND event_type = 'load' AND timestamp >= ?",
            (name, week_start),
        ).fetchone()["cnt"]

        total = conn.execute(
            "SELECT COUNT(*) as cnt FROM skill_events "
            "WHERE skill_name = ? AND event_type = 'load'",
            (name,),
        ).fetchone()["cnt"]

        stats.append({
            "name": name,
            "domain": sk["domain"],
            "today": today,
            "this_week": this_week,
            "total": total,
        })

    conn.close()
    return {"stats": stats}


def get_stale():
    """Detect skills not loaded in >30 days."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    bank_skills = _scan_skill_bank()
    now_ts = time.time()
    stale_threshold = now_ts - STALE_DAYS * 86400

    stale_list = []
    for sk in bank_skills:
        name = sk["name"]
        row = conn.execute(
            "SELECT MAX(timestamp) as last_ts FROM skill_events "
            "WHERE skill_name = ? AND (event_type = 'load' OR event_type = 'seed')",
            (name,),
        ).fetchone()

        last_ts = row["last_ts"] if row and row["last_ts"] else 0
        days_since = (now_ts - last_ts) / 86400 if last_ts else STALE_DAYS * 2

        if days_since > STALE_DAYS:
            stale_list.append({
                "name": name,
                "domain": sk["domain"],
                "days_since_last_load": round(days_since, 1),
                "never_loaded": last_ts == 0,
            })

    conn.close()
    return {"stale": stale_list, "count": len(stale_list),
            "threshold_days": STALE_DAYS}


def get_conflicts():
    """Detect active skills that conflict with each other."""
    loaded = set(SKILL_CACHE_ACTIVE.keys())
    conflicts = []

    for a, b in CONFLICT_PAIRS:
        a_active = a in loaded
        b_active = b in loaded
        if a_active and b_active:
            conflicts.append({
                "skills": [a, b],
                "reason": f"Conflict pair: {a} vs {b}",
                "both_active": True,
            })

    bank_skills = {s["name"] for s in _scan_skill_bank()}
    for name in loaded:
        if name not in bank_skills:
            conflicts.append({
                "skills": [name],
                "reason": f"Skill '{name}' is loaded but NOT in bank pusat",
                "both_active": False,
            })

    return {"conflicts": conflicts, "count": len(conflicts)}


# ── Cleanup old events (keep last 90 days) ──────────────

def cleanup_old_events():
    """Delete skill events older than 90 days, preserving seed events."""
    threshold = time.time() - 90 * 86400
    conn = sqlite3.connect(DB_PATH)
    deleted = conn.execute(
        "DELETE FROM skill_events WHERE timestamp < ? AND event_type != 'seed'",
        (threshold,),
    ).rowcount
    conn.commit()
    conn.close()
    if deleted:
        logger.info("Cleaned up %d old skill events", deleted)
    return deleted


# ── Integration helper: called by sync-to-agents.sh ─────

def notify_sync_completed():
    """Record that sync happened (called from sync-to-agents.sh hook)."""
    record_event("__sync__", agent="system", event_type="sync",
                 metadata={"source": "sync-to-agents.sh"})

    # Re-scan bank and seed any new skills
    _seed_all_skills()

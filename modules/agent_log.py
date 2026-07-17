"""
Agent Activity Log — pencatat aktivitas agent ke SQLite.
Setiap delegasi task, chat, atau eksekusi agent dicatat di sini.
Fungsi: init, log, get_recent, get_stats, cleanup_old
"""
import sqlite3, json, os, datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "agent_log.db")


def init():
    """Inisialisasi database dan tabel jika belum ada."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agent_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent TEXT NOT NULL,
            task TEXT NOT NULL,
            model TEXT,
            status TEXT DEFAULT 'pending',
            tokens_in INTEGER DEFAULT 0,
            tokens_out INTEGER DEFAULT 0,
            duration_ms INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            metadata TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_agent_log_agent ON agent_log(agent)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_agent_log_created ON agent_log(created_at)")
    conn.commit()
    conn.close()


def log(agent, task, model=None, status='pending', tokens_in=0, tokens_out=0, duration_ms=None, metadata=None):
    """
    Catat satu entry aktivitas agent.

    Args:
        agent: Nama agent (builder, pengawas, arsitek, dll)
        task: Deskripsi singkat tugas
        model: Model AI yang dipakai (gemini, claude, dll)
        status: success / failed / pending
        tokens_in: Jumlah token input
        tokens_out: Jumlah token output
        duration_ms: Durasi eksekusi dalam milidetik
        metadata: Dict tambahan (akan di-serialize JSON)
    """
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO agent_log (agent, task, model, status, tokens_in, tokens_out, duration_ms, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (agent, task, model, status, tokens_in, tokens_out, duration_ms,
          json.dumps(metadata or {})))
    conn.commit()
    conn.close()


def get_recent(limit=20):
    """Ambil N aktivitas terbaru."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM agent_log ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_stats():
    """Ambil statistik agregat dari log."""
    conn = sqlite3.connect(DB_PATH)
    total = conn.execute("SELECT COUNT(*) as c FROM agent_log").fetchone()[0]
    by_agent = conn.execute(
        "SELECT agent, COUNT(*) as c FROM agent_log GROUP BY agent ORDER BY c DESC"
    ).fetchall()
    by_status = conn.execute(
        "SELECT status, COUNT(*) as c FROM agent_log GROUP BY status"
    ).fetchall()
    row = conn.execute(
        "SELECT COALESCE(SUM(tokens_in), 0) as ti, COALESCE(SUM(tokens_out), 0) as to_ FROM agent_log"
    ).fetchone()
    conn.close()
    return {
        "total": total,
        "by_agent": dict(by_agent),
        "by_status": dict(by_status),
        "tokens": {"in": row[0] or 0, "out": row[1] or 0}
    }


def get_tokens():
    """Ambil breakdown token per model."""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT model, SUM(tokens_in) as ti, SUM(tokens_out) as to_, COUNT(*) as c "
        "FROM agent_log WHERE model IS NOT NULL GROUP BY model ORDER BY ti DESC"
    ).fetchall()
    conn.close()
    return {
        "total_in": sum(r[1] or 0 for r in rows),
        "total_out": sum(r[2] or 0 for r in rows),
        "by_model": {r[0]: {"in": r[1] or 0, "out": r[2] or 0, "calls": r[3]} for r in rows}
    }


def cleanup_old(days=30):
    """Hapus log lebih dari N hari. Return jumlah baris yang dihapus."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM agent_log WHERE created_at < datetime('now', ?)", (f'-{days} days',))
    deleted = conn.total_changes
    conn.commit()
    conn.close()
    return deleted


# Inisialisasi otomatis saat import
init()

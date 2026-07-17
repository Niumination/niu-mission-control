"""
Content Library — metadata dokumen per agent.
Setiap dokumen yang ditulis oleh agent dicatat di sini.
Fungsi: init, add_entry, get_all, get_by_agent
"""
import sqlite3, json, os, glob

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "content.db")
CONTENT_DIR = os.path.join(os.path.dirname(DB_PATH), "contents")


def init():
    """Inisialisasi database content dan folder contents/."""
    os.makedirs(CONTENT_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent TEXT NOT NULL,
            title TEXT,
            filename TEXT,
            filepath TEXT,
            word_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_content_agent ON content(agent)")
    conn.commit()
    conn.close()


def add_entry(agent, title, filename, filepath, word_count=0):
    """Tambah satu entry dokumen."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO content (agent, title, filename, filepath, word_count)
        VALUES (?, ?, ?, ?, ?)
    """, (agent, title, filename, filepath, word_count))
    conn.commit()
    conn.close()


def get_all():
    """Ambil semua dokumen, urut dari terbaru."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM content ORDER BY created_at DESC LIMIT 100").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_by_agent(agent):
    """Ambil dokumen milik agent tertentu."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM content WHERE agent = ? ORDER BY created_at DESC", (agent,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def scan_contents_dir():
    """Scan folder contents/ dan sync ke DB (jika ada file baru)."""
    if not os.path.isdir(CONTENT_DIR):
        return []
    entries = []
    for agent_dir in sorted(os.listdir(CONTENT_DIR)):
        agent_path = os.path.join(CONTENT_DIR, agent_dir)
        if not os.path.isdir(agent_path):
            continue
        for f in sorted(glob.glob(os.path.join(agent_path, "*.md"))):
            filename = os.path.basename(f)
            # Skip jika sudah ada di DB
            conn = sqlite3.connect(DB_PATH)
            exists = conn.execute(
                "SELECT COUNT(*) FROM content WHERE filepath = ?", (f,)
            ).fetchone()[0]
            conn.close()
            if exists:
                continue
            # Hitung word count
            try:
                with open(f, 'r') as fh:
                    content = fh.read()
                    wc = len(content.split())
            except:
                wc = 0
            title = filename.replace('.md', '').replace('-', ' ').title()
            add_entry(agent_dir, title, filename, f, wc)
            entries.append({"agent": agent_dir, "title": title, "filename": filename})
    return entries


# Inisialisasi otomatis saat import
init()

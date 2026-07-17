# Rencana Induk: Niu-MissionControl Evolution

> **Versi:** 2.1
> **Status:** Final — Menunggu Eksekusi
> **Pemilik:** Afrizal Munthe (Niumination)
> **Terakhir Diperbarui:** 17 Juli 2026
>
> **Visi:** Menggabungkan kekuatan Niu-MC yang sudah ada (6 agen spesialis + hub Telegram + dashboard widget) dengan fitur premium Mission Control Dashboard dari Komputer Mechanic (8 tab + 3D Office + Chat + Content + Schedule) — melahirkan evolusi yang sepenuhnya baru dan unik, tanpa merusak satu baris pun kode yang sudah berjalan.
>
> **Prinsip Utama:** Zero destruction — tidak ada yang dihapus, hanya ditambah atau diperluas. Ekosistem saat ini tetap berjalan selama migrasi.

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Inventaris Aset vs Target](#3-inventaris-aset-vs-target)
4. [Fase Implementasi](#4-fase-implementasi)
5. [Protokol Operasi](#5-protokol-operasi)
6. [Analisis Mode Kegagalan](#6-analisis-mode-kegagalan)
7. [Strategi Verifikasi](#7-strategi-verifikasi)
8. [Daftar Risiko](#8-daftar-risiko)
9. [Timeline & Milestone](#9-timeline--milestone)
10. [Lampiran](#10-lampiran)

---

## 1. Ringkasan Eksekutif

### 1.1 Latar Belakang

**Niu-MissionControl (Niu-MC)** adalah sistem komando terpadu untuk ekosistem Niumination. Saat ini sudah berjalan dengan:

- **6 agen spesialis** (Builder, Pengawas, Arsitek, Penjaga, Scribe, Reach) yang bisa didelegasi tugas via Telegram
- **Dashboard server** (Python, port 5200) dengan 6 widget: system health, agents, gateway, cron, project health, kanban
- **Aturan operasi** yang matang: label taxonomy, approval flow, delegation matrix
- **Runbook** troubleshooting yang terdokumentasi

**Tutorial Komputer Mechanic** (https://komputermechanic.com/tutorials/hermes-mission-control) memperkenalkan:

- Dashboard all-in-one 8 tab (Overview, Agents, Office 3D, Chat, Tasks, Content, Schedule, Docs)
- Topic Router — routing pesan Telegram berdasarkan Topic ID
- Activity logging database + token tracking
- Visual 3D untuk status agen

**Keputusan:** Bukan memilih salah satu, tetapi **melebur keduanya** menjadi sesuatu yang lebih kuat.

### 1.2 Perbandingan: Kita vs Tutorial

| Aspek | Niu-MC Saat Ini | Tutorial KM | Hasil Gabungan |
|-------|-----------------|-------------|----------------|
| Jumlah Agen | 6 spesialis | 5 generic | **6+** — unggul |
| Aturan Operasi | Label taxonomy + approval flow + delegation matrix | Sederhana | **Niu-MC unggul** |
| Dashboard | 6 widget grid | 8 tab system | **Gabungan: 9 tab** |
| Topic Routing | Belum ada | Ada plugin | **Baru: topic router** |
| Activity Log | Belum ada | Ada agent_log.db | **Baru: database** |
| 3D Visual | Belum ada | Office 3D | **Baru: Three.js** |
| Chat via Web | Belum ada | Ada chat tab | **Baru: Hermes bridge** |
| Content Library | Belum ada | Ada per-agent | **Baru: content.db** |
| Token Tracker | Belum ada | Ada | **Baru: dari agent log** |
| Project Git Health | ✅ Ada 30+ repos | Tidak ada | **Niu-MC unggul** |
| Kanban Board | ✅ Drag-drop | Task tab built-in | **Niu-MC unggul** |
| Runbook | ✅ Komplit | Tidak ada | **Niu-MC unggul** |

### 1.3 Dokumen Terkait

Dokumen foundations untuk proyek ini (klik untuk detail):

| Dokumen | File | Status |
|---------|------|--------|
| [Product Requirements Document](DOX/PRD.md) | `DOX/PRD.md` | ✅ Selesai |
| [Technical Specification](DOX/TECHSPEC.md) | `DOX/TECHSPEC.md` | ✅ Selesai |
| [UserFlow & Wireframe](DOX/UX.md) | `DOX/UX.md` | ✅ Selesai |
| [Timeline & Milestones](DOX/TIMELINE.md) | `DOX/TIMELINE.md` | ✅ Selesai |
| [Testing & QA Checklist](DOX/TESTING.md) | `DOX/TESTING.md` | ✅ Selesai |
| [Deployment & Maintenance](DOX/DEPLOY.md) | `DOX/DEPLOY.md` | ✅ Selesai |
| Rencana Induk (ini) | `DOX/MASTERPLAN.md` | ✅ Selesai |

---

## 2. Arsitektur Sistem

### 2.1 Diagram Arsitektur

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      NIU-MISSIONCONTROL EVOLVED                             │
│                        Sistem Komando Tiga Lapis                           │
│                                                                            │
│  ╔══════════════════════════════════════════════════════════════════════╗  │
│  ║                   LAPIS 1: KOMANDO (TELEGRAM)                       ║  │
│  ║                                                                      ║  │
│  ║  ┌──────────────────────────────────────────────────────────────┐   ║  │
│  ║  │              Niu-MissionControl (Main Channel)               │   ║  │
│  ║  │         📌 #general = FULL CAPABILITY (seperti DM)           │   ║  │
│  ║  │         Topic #dev │ #audit │ #plan │ #ops                   │   ║  │
│  ║  │         Topic #docs │ #social                                │   ║  │
│  ║  └────────────┬──────────────────┬──────────────────────────────┘   ║  │
│  ║               │ #general         │ topic spesifik                   ║  │
│  ║               ▼                  ▼                                   ║  │
│  ║  ┌──────────────────┐  ┌───────────────────────────────────────┐   ║  │
│  ║  │ HERMES GATEWAY   │  │ Telegram Topic Router (channel_skill   │   ║  │
│  ║  │ (Full Capability)│  │ _bindings) → routing sesuai skill      │   ║  │
│  ║  │ No restrictions  │  │ Topic ID → mapping → bound skills      │   ║  │
│  ║  └────────┬─────────┘  └────────────────────┬──────────────────┘   ║  │
│  ╚═════════════════════════╤═══════════════════════════════════════════╝  │
│                            │                                              │
│  ╔═════════════════════════╧═══════════════════════════════════════════╗  │
│  ║                   LAPIS 2: INTELIJEN (DASHBOARD)                   ║  │
│  ║                                                                      ║  │
│  ║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  ║  │
│  ║  │ 📊       │ │ 🤖      │ │ 🏙️      │ │ 💬      │ │ 📋      │  ║  │
│  ║  │ Overview │ │ Agents   │ │ Office   │ │ Chat     │ │ Tasks    │  ║  │
│  ║  │ (BARU)   │ │ (BARU)   │ │ (BARU)   │ │ (BARU)   │ │ (EXIST)  │  ║  │
│  ║  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  ║  │
│  ║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              ║  │
│  ║  │ 📄      │ │ ⏰       │ │ 📁      │ │ 📖      │              ║  │
│  ║  │ Content  │ │ Schedule │ │ Projects │ │ Docs     │              ║  │
│  ║  │ (BARU)   │ │ (BARU)   │ │ (EXIST)  │ │ (BARU)   │              ║  │
│  ║  └──────────┘ └──────────┘ └──────────┘ └──────────┘              ║  │
│  ╚═════════════════════════╤═══════════════════════════════════════════╝  │
│                            │                                              │
│  ╔═════════════════════════╧═══════════════════════════════════════════╗  │
│  ║                   LAPIS 3: EKSEKUSI (AGEN + DATA)                  ║  │
│  ║                                                                      ║  │
│  ║  ┌───────────────────────────────────────────────────────────┐     ║  │
│  ║  │                     AGEN FLEET                            │     ║  │
│  ║  │  🏗️ Builder  🔍 Pengawas  📐 Arsitek  🛡️ Penjaga       │     ║  │
│  ║  │  ✍️ Scribe    📡 Reach                                  │     ║  │
│  ║  └──────────────────────┬────────────────────────────────────┘     ║  │
│  ║                         │                                          ║  │
│  ║  ┌──────────────────────┼────────────────────────────────────┐     ║  │
│  ║  │              DATA LAYER (LAMA + BARU)                     │     ║  │
│  ║  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │     ║  │
│  ║  │  │kanban.db │  │state.db  │  │agent_log│  │content   │ │     ║  │
│  ║  │  │ (EXIST)  │  │ (EXIST)  │  │ .db     │  │ .db      │ │     ║  │
│  ║  │  │          │  │          │  │ (BARU)   │  │ (BARU)   │ │     ║  │
│  ║  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │     ║  │
│  ║  └──────────────────────────────────────────────────────────┘     ║  │
│  ╚══════════════════════════════════════════════════════════════════════╝  │
│                                                                            │
│  ╔══════════════════════════════════════════════════════════════════════╗  │
│  ║                   INFRASTRUKTUR (BARU)                              ║  │
│  ║  ┌──────────────────────┐    ┌──────────────────────────────────┐   ║  │
│  ║  │ Tailscale Tunnel     │    │ Akses Dashboard dari mana saja   │   ║  │
│  ║  │ (remote access)      │◄──▶│ http://<tailscale-ip>:5200       │   ║  │
│  ║  └──────────────────────┘    └──────────────────────────────────┘   ║  │
│  ╚══════════════════════════════════════════════════════════════════════╝  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Alur Data

**Alur #General (Unrestricted):**
```
Pengguna → Telegram (topic #general) → Hermes Gateway
  → Topic ID = 1 → TIDAK ada skill bindings → FULL CAPABILITY
  → Sama seperti DM: semua tools/skills tersedia
  → Response dikirim ke topic #general
```

**Alur Topic Spesifik (Skill-Bound):**
```
Pengguna → Telegram (topic #dev) → Topic Router Plugin
  → Deteksi Topic ID = 2 → mapping ke "builder"
  → Forward pesan ke profil Builder
  → Builder proses via Hermes/Gateway
  → Response dikirim ke topic #dev
  → Activity dicatat ke agent_log.db
  → Dashboard Overview langsung tampil update
```

```
Pengguna → Dashboard Chat Tab → Hermes API Bridge
  → Pilih agent "pengawas" + tulis pesan
  → POST /api/mc/chat {agent: "pengawas", message: "..."}
  → Bridge kirim ke Hermes → Gateway → model
  → Response balik ke dashboard
  → Activity dicatat ke agent_log.db
```

### 2.3 Kepemilikan Komponen

| Layer | Komponen | Status | Teknologi | Port |
|-------|----------|--------|-----------|------|
| **Komando** | Telegram Niu-MC Group | ✅ Existing | Telegram Bot API | - |
| | Topic Router Plugin | 🔧 Baru | Hermes Plugin (Python) | - |
| | Orkestrator (Hermes) | ✅ Existing | Hermes Agent | - |
| **Dashboard** | Web server | ✅ Existing | Python http.server | 5200 |
| | 6 widget existing | ✅ Existing | Vanilla JS + CSS | - |
| | Overview Tab | 🔧 Baru | CSS Grid + Chart.js | - |
| | Agents Tab | 🔧 Baru | Chart.js heatmap | - |
| | Office 3D | 🔧 Baru | Three.js (CDN) | - |
| | Chat Tab | 🔧 Baru | Hermes API bridge | - |
| | Task/Kanban | ✅ Existing (iframe) | niu-kanban-dash | 5199 |
| | Content Tab | 🔧 Baru | File scanner | - |
| | Schedule Tab | 🔧 Baru | Hermes cron API | - |
| | Projects Tab | ✅ Existing | get-git.py | - |
| **Data** | kanban.db | ✅ Existing | SQLite | - |
| | state.db | ✅ Existing | SQLite | - |
| | agent_log.db | 🔧 Baru | SQLite | - |
| | content.db | 🔧 Baru | SQLite | - |
| **Infra** | Tailscale | 🔧 Baru | Tailscale + hermes.json | - |
| | Gateway (launchd) | ✅ Existing | launchd + hermes gateway | - |

---

## 3. Inventaris Aset vs Target

### 3.1 ✅ Sudah Jadi — Dipertahankan dan Ditingkatkan

| Fitur | Niu-MC Sekarang | Tutorial KM | Tindakan |
|-------|----------------|-------------|----------|
| **Armada Agen** | 6 spesialis (Builder, Pengawas, Arsitek, Penjaga, Scribe, Reach) | 5 generic (Scout, Scribe, Reach, Dev) | ✅ Unggul. Hanya perlu definisi lebih dalam |
| **Aturan Operasi** | Label taxonomy, approval flow, delegation matrix, failure protocol | Routing sederhana | ✅ Unggul. Dipertahankan |
| **Server Dashboard** | Port 5200, Python http.server | Python (mirip) | ✅ Base sama, diperluas |
| **API Endpoint** | 6 endpoint (aggregated, system, agents, cron, projects, gateway) | N/A | ✅ Kuat, ditambah |
| **Papan Kanban** | Drag-drop via iframe port 5199 | Task tab built-in | ✅ Pilih yang terbaik: tetap pakai kanban dash + integrasi |
| **Kesehatan Proyek** | get-git.py monitoring 30+ repos | N/A | ✅ Keunggulan unik |
| **Runbook** | Troubleshooting + recovery checklist | N/A | ✅ Dipertahankan, diperluas |

### 3.2 🔧 Baru — Diadaptasi dari Tutorial

| Fitur Tutorial | Adaptasi untuk Niu-MC | Upaya | Prioritas |
|----------------|----------------------|-------|-----------|
| **Topic Router Plugin** | Plugin Hermes: Topic ID → routing ke agen | Kecil | P1 |
| **Agent Activity Log DB** | Catat: timestamp, agen, tugas, model, status, token | Sedang | P1 |
| **Dashboard Overview Tab** | Gateway + activity feed + hardware + token | Sedang | P1 |
| **Agents Tab + Heatmap** | Kartu per agen, heatmap (Chart.js), pie chart | Sedang | P1 |
| **Chat Tab (Dashboard)** | Chat agen dari browser via Hermes API bridge | Besar | P2 |
| **Content Tab** | Auto-save dokumen per folder agen, filter by agent | Sedang | P2 |
| **Schedule Tab** | Daftar cron visual + trigger + hapus dari dashboard | Sedang | P2 |
| **Office 3D** | Three.js city towers, glow orange/biru per status | Sangat Besar | P3 |
| **Token Usage Tracker** | Log konsumsi token per model per sesi | Kecil | P2 |
| **Tailscale** | Akses remote via Tailscale tunnel | Kecil | P1 |

### 3.3 🆓 Bonus — Eksklusif Niu-MC (Tutorial Tidak Punya)

| Fitur | Deskripsi |
|-------|-----------|
| **Kesehatan Git Proyek** | Status 30+ repos Niumination langsung di dashboard |
| **Audit Ekosistem** | Cross-reference DOX vs filesystem |
| **Brain Vault** | Integrasi Obsidian vault |
| **Papan Kanban** | Drag-drop task management + kanban.db |
| **API Aggregator** | Satu endpoint `/api/mc/aggregated` untuk semua data |
| **Runbook Komplit** | Troubleshooting + recovery checklist teruji |
| **6 Agen Spesialis** | Lebih banyak dari tutorial, dengan aturan delegasi formal |

---

## 4. Fase Implementasi

### Aturan Kritis

> **Setiap fase bersifat additive-only.** Tidak ada file yang dihapus — hanya ditambah atau diperluas. Ekosistem saat ini tetap berjalan selama migrasi. Jika ada konflik, kode lama yang menang. File baru pakai nama atau path yang berbeda.

---

### 🔵 Fase 1: Fondasi Data Layer (45 menit)

**Tujuan:** Membuat database logging sebagai fondasi semua fitur baru.

#### Tugas 1.1 — Agent Activity Log DB

Buat `modules/agent_log.py`:

```python
"""Agent Activity Log — catat setiap aksi agent ke SQLite."""
import sqlite3, json, os, datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "agent_log.db")

def init():
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

def log(agent, task, model=None, status='pending', tokens_in=0, tokens_out=0, metadata=None):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO agent_log (agent, task, model, status, tokens_in, tokens_out, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (agent, task, model, status, tokens_in, tokens_out, json.dumps(metadata or {})))
    conn.commit()
    conn.close()

def get_recent(limit=20):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM agent_log ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_stats():
    conn = sqlite3.connect(DB_PATH)
    total = conn.execute("SELECT COUNT(*) as c FROM agent_log").fetchone()[0]
    by_agent = conn.execute(
        "SELECT agent, COUNT(*) as c FROM agent_log GROUP BY agent ORDER BY c DESC"
    ).fetchall()
    by_status = conn.execute(
        "SELECT status, COUNT(*) as c FROM agent_log GROUP BY status"
    ).fetchall()
    tokens = conn.execute(
        "SELECT SUM(tokens_in) as ti, SUM(tokens_out) as to_ FROM agent_log"
    ).fetchone()
    conn.close()
    return {
        "total": total,
        "by_agent": dict(by_agent),
        "by_status": dict(by_status),
        "tokens": {"in": tokens[0] or 0, "out": tokens[1] or 0}
    }

def cleanup_old(days=30):
    """Hapus log lebih dari N hari untuk menghemat disk."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM agent_log WHERE created_at < datetime('now', ?)", (f'-{days} days',))
    deleted = conn.total_changes
    conn.commit()
    conn.close()
    return deleted
```

**Verifikasi:** `python3 modules/agent_log.py && python3 -c "from modules.agent_log import *; init(); print('✅ OK:', get_stats())"` → JSON valid

#### Tugas 1.2 — Content Library DB

Buat `modules/content_db.py`:

```python
"""Content Library — metadata dokumen per agent."""
import sqlite3, json, os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "content.db")
CONTENT_DIR = os.path.join(os.path.dirname(DB_PATH), "contents")

def init():
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
```

**Verifikasi:** `python3 -c "from modules.content_db import *; init(); print('✅ content.db siap')"`

#### Tugas 1.3 — Endpoint API Baru

Tambahkan ke `server.py`:

```python
# Endpoint baru untuk activity log
if path == "/api/mc/activity":
    from modules.agent_log import get_recent
    data = get_recent(limit=20)
    # kirim JSON

if path == "/api/mc/activity/stats":
    from modules.agent_log import get_stats
    data = get_stats()
    # kirim JSON
```

**Verifikasi:** `curl http://localhost:5200/api/mc/activity` → `[{"agent": ..., "task": ...}]`

#### Tugas 1.4 — Buat Direktori Data

```bash
mkdir -p data/contents/{builder,pengawas,arsitek,penjaga,scribe,reach}
```

**Verifikasi:** `ls -la data/contents/` → 6 folder agent

#### Kasus Pinggiran Fase 1:

| Kasus | Penanganan |
|-------|-----------|
| Path DB tidak writable (ExFAT) | Fallback ke `~/Library/Application Support/Niu-MC/data/` |
| SQLite concurrent write | Gunakan `PRAGMA journal_mode=WAL` |
| DB corruption | Auto-create ulang jika `sqlite3.connect` gagal |
| Log membesar >100MB | Cron cleanup otomatis >30 hari |
| state.db sudah ada | Jangan hapus — dual-write sampai stabil |

---

### 🟢 Fase 2: Telegram Topic Router Plugin (1 jam)

**Tujuan:** Satu group Telegram dengan topic per agent. Posting di #dev → Builder menjawab di thread yang sama.

#### Tugas 2.1 — Pelajari Topic ID Telegram

Fakta penting:
- Setiap topic punya `message_thread_id` unik dalam group
- Bot perlu `message_thread_id` di parameter `sendMessage` untuk membalas di topic yang benar
- Topic ID bisa didapat via bot event `message.message_thread_id`
- Bot harus **admin** di group dengan Topics diaktifkan

#### Tugas 2.2 — Buat Plugin Topic Router

Buat `plugins/telegram_router/__init__.py`:

```python
"""
Telegram Topic Router untuk Hermes Agent.
Mendeteksi Topic ID dari pesan masuk → routing ke profil agent yang sesuai.
"""
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Mapping: Topic ID → Nama Agent
# Didapat dari @userinfobot di Telegram
TOPIC_MAP: Dict[int, str] = {
    1: "orchestrator",   # #general — urusan umum
    2: "builder",        # #dev — coding, implementasi
    3: "pengawas",       # #audit — review, keamanan
    4: "arsitek",        # #plan — arsitektur, riset
    5: "penjaga",        # #ops — operasi, monitoring
    6: "scribe",         # #docs — dokumentasi
    7: "reach",          # #social — outreach
}

TOPIC_MAP_REVERSE = {v: k for k, v in TOPIC_MAP.items()}

class TelegramRouterPlugin:
    """Plugin untuk routing Telegram berdasarkan Topic ID."""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self.topic_map = self.config.get("topic_map", TOPIC_MAP)

    def get_agent_for_topic(self, topic_id: int) -> str:
        """Kembalikan nama agent berdasarkan Topic ID."""
        return self.topic_map.get(topic_id, "orchestrator")

    def get_topic_for_agent(self, agent_name: str) -> Optional[int]:
        """Kembalikan Topic ID untuk agent tertentu."""
        reverse = {v: k for k, v in self.topic_map.items()}
        return reverse.get(agent_name)
```

#### Tugas 2.3 — Integrasikan ke Hermes Config

Plugin perlu didaftarkan di `~/.hermes/config.yaml`:

```yaml
plugins:
  telegram_router:
    enabled: true
    path: "/Users/zaryu/Desktop/Niumination/projects/niu-mission-control/plugins/telegram_router"
    config:
      topic_map:
        1: orchestrator
        2: builder
        3: pengawas
        4: arsitek
        5: penjaga
        6: scribe
        7: reach
```

#### Tugas 2.4 — Uji Routing

1. Kirim pesan di topic #dev → harus dijawab Builder
2. Kirim pesan di topic #docs → harus dijawab Scribe
3. Kirim pesan di #general → orchestator handle
4. Kirim pesan di topic tanpa mapping → fallback ke orchestrator

**Verifikasi:** Agent menjawab di topic yang benar, thread ID sesuai.

#### Kasus Pinggiran Fase 2:

| Kasus | Penanganan |
|-------|-----------|
| Topic ID berubah (topic dihapus/dibuat ulang) | Simpan mapping di file config YAML, bukan hardcode |
| Bot tidak punya akses topic | Pastikan bot admin di group dengan Topics ON |
| Agent tidak menjawab dalam 30 detik | Orchestrator handle + log warning |
| Pesan dari topic tanpa mapping | Route ke orchestrator (default) |
| Topic ID 0 (thread utama) | Route ke orchestrator |

---

### 🟡 Fase 3: Dashboard 2.0 — Overview + Agents Tab (2 jam)

**Tujuan:** Transisi dashboard dari widget grid ke sistem 9 tab.

#### Tugas 3.1 — Refactor Server ke Multi-Tab

Perluas `MCHandler.do_GET()` di `server.py`:

```python
TABS = {
    'overview': 'dashboard/overview.html',
    'agents': 'dashboard/agents.html',
    'office': 'dashboard/office.html',
    'chat': 'dashboard/chat.html',
    'tasks': 'dashboard/tasks.html',
    'content': 'dashboard/content.html',
    'schedule': 'dashboard/schedule.html',
    'projects': 'dashboard/projects.html',
    'docs': 'dashboard/docs.html',
}

def do_GET(self):
    parsed = urllib.parse.urlparse(self.path)
    path = parsed.path.strip('/') or 'overview'

    # API endpoints — handle dulu
    if path.startswith('api/'):
        return self.handle_api(path)

    # Tab routing
    if path in TABS:
        self.path = TABS[path]
        return super().do_GET()

    # File statis (CSS, JS, gambar)
    self.path = parsed.path
    return super().do_GET()
```

#### Tugas 3.2 — Navigasi Tab

Buat `dashboard/nav.html` — komponen navigasi yang di-include di setiap tab:

```html
<nav class="tab-nav">
  <a href="/overview" class="tab" data-tab="overview">📊 Overview</a>
  <a href="/agents" class="tab" data-tab="agents">🤖 Agents</a>
  <a href="/office" class="tab" data-tab="office">🏙️ Office</a>
  <a href="/chat" class="tab" data-tab="chat">💬 Chat</a>
  <a href="/tasks" class="tab" data-tab="tasks">📋 Tasks</a>
  <a href="/content" class="tab" data-tab="content">📄 Content</a>
  <a href="/schedule" class="tab" data-tab="schedule">⏰ Schedule</a>
  <a href="/projects" class="tab" data-tab="projects">📁 Projects</a>
  <a href="/docs" class="tab" data-tab="docs">📖 Docs</a>
</nav>
```

#### Tugas 3.3 — Overview Tab

Buat `dashboard/overview.html`:

| Bagian | Sumber Data | Visual |
|--------|------------|--------|
| **Status Gateway** | `/api/mc/gateway` | Badge hijau/merah + last seen |
| **Aktivitas Terkini** | `/api/mc/activity` | Live feed: agent, task, model, waktu |
| **Sistem** | `/api/mc/system` | Bar CPU, RAM, Disk |
| **Token Usage** | `/api/mc/tokens` | Breakdown per model |
| **Beban Kerja** | `/api/mc/activity/stats` | Bar chart: agent vs jumlah task |

#### Tugas 3.4 — Agents Tab

Buat `dashboard/agents.html`:

| Komponen | Visualisasi |
|----------|-------------|
| **Kartu per agent** | 6 kartu: nama, emoji, badge status, task terakhir, success rate, model |
| **Activity Heatmap** | Chart.js heatmap: 24 jam × 7 hari |
| **Pie Chart Distribusi** | Chart.js doughnut: siapa handle task terbanyak |
| **Pemilih Model** | Dropdown per agent (visual only, config change manual) |

Chart.js dari CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`

#### Tugas 3.5 — Index Redirect

Update `dashboard/index.html` untuk redirect ke `/overview`:

```html
<script>
  window.location.replace('/overview');
</script>
```

#### Kasus Pinggiran Fase 3:

| Kasus | Penanganan |
|-------|-----------|
| Chart.js gagal load (offline) | Fallback ke tabel statis |
| Heatmap data kosong | Tampilkan "Belum ada aktivitas" placeholder |
| Tab kosong saat baru deploy | Loading state dengan skeleton |
| Server-side include nav.html | Gunakan fetch() JavaScript, bukan SSI |
| Halaman di-refresh | Kembali ke tab terakhir (localStorage) |
| Tab tidak ditemukan (404) | Redirect ke /overview |

---

### 🔵 Fase 4: Chat + Schedule + Content Tabs (1,5 jam)

**Tujuan:** 3 tab fungsional: chat agent, manajemen cron, perpustakaan konten.

#### Tugas 4.1 — Chat Tab

Buat `dashboard/chat.html`:
- **Sidebar:** 6 tombol agent dengan avatar emoji
- **Area chat:** Riwayat pesan + input box
- **API:** `POST /api/mc/chat` → kirim ke Hermes → balik response

```python
@app.route('/api/mc/chat', methods=['POST'])
def handle_chat():
    data = json.loads(request.body)
    agent = data.get('agent', 'orchestrator')   # builder, pengawas, etc.
    message = data.get('message', '')

    # Bridge ke Hermes via CLI
    result = subprocess.run(
        ['hermes', 'chat', '--agent', agent, '--message', message],
        capture_output=True, text=True, timeout=60
    )
    # Catat ke activity log
    from modules.agent_log import log
    log(agent=agent, task=f"chat: {message[:50]}...",
        status='success' if result.returncode == 0 else 'failed')

    return json.dumps({
        "response": result.stdout if result.returncode == 0 else "Maaf, agent sedang tidak tersedia."
    })
```

#### Tugas 4.2 — Schedule Tab

Buat `dashboard/schedule.html`:
- **Tabel cron jobs** dari `/api/mc/cron`
- **Tombol Run Now** → `POST /api/mc/cron/run/{id}`
- **Tombol Hapus** → `POST /api/mc/cron/delete/{id}`
- **Badge status** + next run time

#### Tugas 4.3 — Content Tab

Buat `dashboard/content.html`:
- **Daftar dokumen** dari content.db, di-group by agent
- **Filter dropdown:** All, Builder, Pengawas, dst.
- **Tiap dokumen:** judul, agent, word count, created_at
- **API:** `/api/mc/content` → list dokumen

#### Tugas 4.4 — Docs Tab

Buat `dashboard/docs.html`:
- **Daftar DOX** dari folder `DOX/`
- **Status badge** per dokumen (✅ lengkap / 🔧 parsial / ❌ missing)
- **Link baca** setiap dokumen

#### Kasus Pinggiran Fase 4:

| Kasus | Penanganan |
|-------|-----------|
| Chat ke agent offline | "Agent tidak tersedia. Coba via Telegram?" |
| Cron trigger gagal | Tampilkan error, jangan crash server |
| Content folder kosong | "Belum ada dokumen. Minta agent menulis!" |
| File content besar | Truncate + "Baca selengkapnya" |
| Hermes CLI tidak ditemukan | Fallback: log error, tampilkan pesan di chat |

---

### 🟣 Fase 5: Office 3D + Token Tracking + Tailscale (2 jam)

**Tujuan:** Fitur premium visual + infrastruktur akses remote.

#### Tugas 5.1 — Office 3D Tab (Alternatif Ringan)

Buat `dashboard/office.html`:

**Opsi A (Three.js — full 3D):**
- 6 tower (bangunan) dalam layout kota 3D
- Setiap tower punya glow: **oranye** (idle) → **biru** (bekerja)
- Polling tiap 5 detik: `/api/mc/agents` → update glow
- Orbit controls untuk rotasi kamera

**Opsi B (CSS 3D — fallback ringan):**
Jika Three.js terlalu berat, gunakan CSS transform dengan 6 card towers:
```css
.tower { transform: perspective(800px) rotateX(20deg); transition: box-shadow 1s; }
.tower.idle { box-shadow: 0 0 30px #f97316; }  /* oranye */
.tower.working { box-shadow: 0 0 30px #3b82f6; }  /* biru */
```

#### Tugas 5.2 — Token Usage Dashboard

Tambahkan ke Overview + Agents tab:
- **Total token** (in + out) sepanjang masa
- **Breakdown per model** (gemini, openrouter, dll)
- **Tren harian** — Chart.js bar chart 7 hari

Sumber data: `agent_log.tokens_in` + `tokens_out`

#### Tugas 5.3 — Tailscale Remote Access

```bash
# Install Tailscale (jika belum)
brew install --cask tailscale

# Auth
tailscale up

# Dapatkan IP Tailscale
tailscale ip -4
# Contoh: 100.x.x.x

# Update dashboard listener
# Di server.py: ('', PORT) sudah 0.0.0.0 secara default
```

**Verifikasi:** `curl http://<tailscale-ip>:5200` → dashboard tampil

#### Kasus Pinggiran Fase 5:

| Kasus | Penanganan |
|-------|-----------|
| Three.js gagal render | Fallback otomatis ke CSS towers |
| GPU tidak support WebGL | CSS fallback |
| Token data kosong | "Tracking token dimulai setelah aktivasi" |
| Animasi terlalu berat | Throttle requestAnimationFrame ke 10fps |
| Tailscale tidak terinstall | Dokumentasi SSH tunnel sebagai alternatif |

---

### 🧪 Fase 6: Pengujian + Dokumentasi + Deployment (1 jam)

**Tujuan:** Quality gate sebelum go-live.

#### Tugas 6.1 — Dokumen Foundation

6 dokumen foundation sudah selesai sesuai template `project-foundation`:

| Dokumen | File | Status |
|---------|------|--------|
| [Product Requirements Document](DOX/PRD.md) | `DOX/PRD.md` | ✅ Selesai |
| [Technical Specification](DOX/TECHSPEC.md) | `DOX/TECHSPEC.md` | ✅ Selesai |
| [UserFlow & Wireframe](DOX/UX.md) | `DOX/UX.md` | ✅ Selesai |
| [Timeline & Milestones](DOX/TIMELINE.md) | `DOX/TIMELINE.md` | ✅ Selesai |
| [Testing & QA Checklist](DOX/TESTING.md) | `DOX/TESTING.md` | ✅ Selesai |
| [Deployment & Maintenance](DOX/DEPLOY.md) | `DOX/DEPLOY.md` | ✅ Selesai |

#### Tugas 6.2 — Update AGENTS.md + ORCHESTRATOR.md

Perbarui kedua dokumen dengan:
- Arsitektur baru (9 tab system)
- Protokol Topic Router
- Mekanisme Activity Logging

#### Tugas 6.3 — Smoke Test

| Test | Harapan |
|------|---------|
| `python3 server.py` | Listen di port 5200 |
| `curl http://localhost:5200/` | 200, HTML overview |
| `curl http://localhost:5200/api/mc/activity` | JSON array |
| `curl http://localhost:5200/agents` | 200, HTML agents |
| Buka tiap tab di browser | Tidak ada console error |
| Post di Telegram topic #dev | Builder menjawab di topic yang sama |
| Trigger cron dari Schedule tab | Cron job berjalan |

#### Tugas 6.4 — Update RUNBOOK

Tambah section baru:
- Troubleshooting Topic Router
- Maintenance agent_log.db
- Troubleshooting dashboard tab
- Tailscale setup & troubleshooting

---

## 5. Protokol Operasi

### 5.1 Aturan Routing Tab

| Tindakan Pengguna | Respon Sistem |
|-------------------|---------------|
| Buka `/` | Redirect ke `/overview` |
| Klik tab navigasi | Load HTML partial via AJAX (no full reload) |
| Refresh halaman | Kembali ke tab terakhir (localStorage) |
| Tab tidak ditemukan | 404 → redirect ke `/overview` |

### 5.2 Protokol Pencatatan Aktivitas Agent

Setiap interaksi dengan agent WAJIB dicatat:

```python
# Wajib dipanggil di:
# 1. Setiap response dari agent (via herdr, Niu-Flow, direct)
# 2. Setiap chat dari dashboard Chat tab
# 3. Setiap cron job yang di-trigger dari Schedule tab

from modules.agent_log import log

log(
    agent=agent_name,      # builder, pengawas, dll
    task=task_description,  # Deskripsi singkat
    model=model_used,       # gemini/gpt/claude
    status=result_status,   # success/failed/pending
    tokens_in=input_tokens,
    tokens_out=output_tokens
)
```

### 5.3 Protokol Perpustakaan Konten

```
Ketika agent menulis long-form document:

1. Simpan file markdown di:
   data/contents/{agent_name}/{YYYY-MM-DD}-{judul-slug}.md

2. Gunakan format header yang konsisten:
   # Judul
   **Tanggal:** YYYY-MM-DD
   **Penulis:** {agent_name}
   ---
   [konten]

3. Jangan kirim full document di Telegram chat
   Cukup notifikasi: "📄 Dokumen baru: [judul] — lihat di Content tab"
```

### 5.4 Protokol Topic Router

> **PENTING:** Topic 1 (#General) = **UNRESTRICTED** — tidak terikat `channel_skill_bindings` apa pun.
> Berfungsi identik dengan DM: full agent capability, tanpa @mention, tanpa filter skill.
> Topic spesifik (230-236) dibatasi oleh bindings masing-masing untuk fokus kerja.

```yaml
# Konfigurasi Topic Router & Skill Bindings
# Berlaku di: Hermes config.yaml → telegram.allowed_topics + channel_skill_bindings
#
# ID Group Niu-MissionControl: -1004204696417

# #General — FULL CAPABILITY (seperti DM)
topic_1:
  role: "command-center"
  skill_bindings: []                # ❌ Tidak ada — unrestricted
  require_mention: false
  free_response: true

# Topic Spesifik — masing-masing terikat ke skill tertentu
topic_230:                          # #dev
  role: "development"
  skill_bindings:
    - project-foundation
    - writing-plans

topic_231:                          # #audit
  role: "audit"
  skill_bindings:
    - kanban-orchestrator

topic_232:                          # #docs
  role: "documentation"
  skill_bindings: []                # ✅ Bisa diisi nanti

topic_233:                          # #social
  role: "social-media"
  skill_bindings: []                # ✅ Bisa diisi nanti

topic_235:                          # #plan
  role: "planning"
  skill_bindings:
    - ponytail
    - requesting-code-review

topic_236:                          # #ops
  role: "operations"
  skill_bindings:
    - codebase-audit
```

### 5.5 Aturan Zero Destruction

1. **JANGAN** menghapus atau memodifikasi file existing yang sedang berjalan
2. **JANGAN** mengubah port server (5200 tetap)
3. **JANGAN** mengubah API endpoint yang sudah ada — hanya tambah yang baru
4. **JANGAN** hapus state.db atau kanban.db
5. **JIKA** harus mengubah kode existing, buat branch dulu
6. **JIKA** ada konflik nama file, gunakan nama baru (misal: `server_v2.py`)

---

## 6. Analisis Mode Kegagalan

### 6.1 Katalog Mode Kegagalan

| Komponen | Mode Kegagalan | Dampak | Probabilitas | Severitas | Pemulihan |
|----------|---------------|--------|-------------|-----------|-----------|
| **Telegram API** | Down / rate limit | Pusat komando offline | Rendah | Kritis | Tunggu. Pesan antri di server Telegram |
| **Hermes Agent** | Crash / OOM | Orkestrator offline | Sedang | Kritis | Auto-restart oleh launchd |
| **Herdr Socket** | ExFAT broken | Agent unreachable | Tinggi | Tinggi | Symlink fix (`RUNBOOK.md`) |
| **Herdr Agent** | Hang / stuck | Task tidak selesai | Sedang | Sedang | `herdr agent kill` → restart |
| **agent_log.db** | Corruption | Activity tidak tercatat | Rendah | Rendah | Auto-create ulang |
| **Kanban DB** | Locked | Dashboard 500 | Rendah | Sedang | Kill stale sqlite3 procs |
| **Gateway** | Crash | Tidak ada akses model | Sedang | Kritis | launchd auto-restart |
| **Topic Router** | Config error | Pesan tidak ter-routing | Rendah | Tinggi | Fallback: semua ke orchestrator |
| **Chart.js CDN** | Offline | Heatmap/chart tidak render | Rendah | Rendah | Fallback: tabel statis |
| **Three.js CDN** | Offline | Office tab blank | Rendah | Rendah | CSS fallback |
| **Chat Tab** | Hermes timeout | Agent tidak merespon | Sedang | Sedang | Retry 2x, lalu "Agent offline" |
| **Tailscale** | Auth expired | Remote access down | Rendah | Sedang | Re-auth via browser |
| **server.py** | Python crash | Semua tab down | Rendah | Kritis | Auto-restart + health check |
| **Disk Full** | No space | Semua gagal | Rendah | Kritis | Alert + cleanup |
| **ExFAT USB disconnect** | Total system loss | Semua offline | Rendah | Kritis | Backup config ke APFS |

### 6.2 Matriks Mitigasi

| Kegagalan | Mitigasi | Diimplementasikan Di |
|-----------|----------|---------------------|
| ExFAT socket | Symlink fix di RUNBOOK | Sudah ada |
| Agent hang | Timeout + kill script | Sudah ada |
| Dashboard crash | Auto-restart cron check | Fase 6 |
| Disk full | Alert di 85% | Fase 1 (system widget) |
| agent_log.db corrupt | Auto-create + WAL mode | Fase 1 |
| Topic ID salah | Default ke orchestrator | Fase 2 |
| Three.js fallback | CSS towers alternative | Fase 5 |

### 6.3 Critical Path

**Jalur kritis untuk operasi harian:**
```
Telegram → Hermes Agent → (pilih jalur)
  ├── Gateway (model) → WAJIB HIDUP
  ├── Herdr socket → WAJIB TERKONEKSI
  └── Filesystem (ExFAT) → WAJIB TERMOUNT
```

**Single point of failure:**
1. **Hermes Agent** — jika crash, tidak ada redundancy. Mitigasi: auto-restart via launchd.
2. **ExFAT USB** — HermesAgent USB disconnect = total loss. Mitigasi: backup config ke APFS.
3. **Gateway (model)** — jika opencode-zen down, fallback chain harus siap (sudah dikonfigurasi).
4. **Topic ID mapping** — jika salah konfigurasi, agent tidak ter-routing. Mitigasi: mapping di file YAML, backup ke git.

---

## 7. Strategi Verifikasi

### 7.1 Smoke Test Per Fase

| Fase | Test | Perintah / Metode | Harapan |
|------|------|------------------|---------|
| P1 | Init agent log | `python3 -c "from modules.agent_log import *; init(); print('OK')"` | `OK` |
| P1 | API activity | `curl http://localhost:5200/api/mc/activity` | JSON `[{agent:..., task:...}]` |
| P1 | API stats | `curl http://localhost:5200/api/mc/activity/stats` | JSON with counts |
| P2 | Topic routing | Kirim "test" di topic #dev | Builder reply di topic #dev |
| P3 | Dashboard tabs | Buka `/overview`, `/agents` di browser | 200, HTML termuat |
| P3 | Agent cards | Buka `/agents` | 6 kartu dengan data live |
| P4 | Chat send | `curl -X POST /api/mc/chat -d '{"agent":"builder","message":"ping"}'` | Response JSON |
| P4 | Schedule list | `curl http://localhost:5200/api/mc/cron` | JSON cron array |
| P4 | Content list | `curl http://localhost:5200/api/mc/content` | JSON atau empty array |
| P5 | Office tab | Buka `/office` | Tower render (3D atau CSS) |
| P5 | Token API | `curl http://localhost:5200/api/mc/tokens` | JSON with in/out counts |
| P5 | Tailscale | `curl http://<tailscale-ip>:5200` | 200 OK |
| P6 | Dokumen | `ls DOX/*.md` | 7 file (MASTERPLAN + 6 docs) |

### 7.2 Integration Test

1. **Post di Telegram topic #dev** → Builder catch → log ke agent_log.db → muncul di Activity feed Overview → muncul di Agents card
2. **Chat dari dashboard** → POST ke `/api/mc/chat` → bridge ke Hermes → log activity → response balik
3. **Trigger cron dari Schedule tab** → POST run → cron job execute → log ke agent_log.db → status update
4. **Agent selesai task** → `log()` dipanggil → muncul di recent activity → Overview token count update
5. **Tailscale dari mobile** → buka URL → dashboard render responsive

### 7.3 Chaos Test

| Test | Prosedur | Harapan |
|------|----------|---------|
| **Agent log DB dihapus** | `rm data/agent_log.db`, refresh dashboard | Auto-create baru, activity kosong |
| **Topic ID salah** | Kirim di topic tidak terdaftar | Route ke orchestrator (default) |
| **Hermes gateway down** | Stop gateway, coba chat dari dashboard | "Agent offline. Coba via Telegram?" |
| **Tailscale disconnect** | Matikan Tailscale | Dashboard tetap jalan di localhost |
| **server.py crash** | `kill <pid>`, tunggu 10 detik | launchd auto-restart, semua tab pulih |

---

## 8. Daftar Risiko

| ID | Risiko | Dampak | Prob. | Mitigasi |
|----|--------|--------|-------|----------|
| R1 | **Topic ID mapping hilang** saat topic dihapus | Tinggi | Rendah | Simpan mapping di YAML config, backup ke git |
| R2 | **Plugin Hermes tidak kompatibel** versi baru | Tinggi | Sedang | Pin versi plugin di config, test dulu |
| R3 | **Dashboard terlalu besar** (8 tab + JS library) | Sedang | Sedang | Lazy load JS, code splitting per tab |
| R4 | **ExFAT USB disconnect** saat write log | Sedang | Tinggi | Write-ahead logging (WAL), queue jika disk unavailable |
| R5 | **Three.js Office tab render lambat** di Mac lama | Rendah | Sedang | Auto-detect GPU, fallback ke CSS version |
| R6 | **Token logging overhead** memperlambat response | Sedang | Rendah | Async write ke DB (thread pool), jangan blocking |
| R7 | **Dokumen foundation tidak diupdate** seiring kode | Sedang | Tinggi | Update tiap phase gate, audit mingguan |
| R8 | **Chart.js/Three.js CDN mati** saat offline | Rendah | Rendah | Host JS lokal sebagai fallback |

---

## 9. Timeline & Milestone

### Estimasi Total: ~7 jam kerja efektif (tersebar, tidak perlu 7 jam berturut-turut)

### Milestone

| Milestone | Target | Deliverable | Dependensi |
|-----------|--------|-------------|------------|
| **M1: Data Layer** | +45 menit | agent_log.db + content_db + API endpoints | - |
| **M2: Topic Router** | +1 jam | Plugin routing 6 agent via Topic ID | M1 (logging) |
| **M3: Dashboard 2.0** | +2 jam | Overview + Agents tabs live | M1 (activity data) |
| **M4: Chat + Content + Schedule** | +1,5 jam | 3 tab fungsional | M3 (server refactor) |
| **M5: Premium Features** | +2 jam | Office 3D + Token + Tailscale | M1 (token data), M3 (server) |
| **M6: Docs & QA** | +1 jam | 6 foundation docs + smoke test passed | M1-M5 selesai |

### Opsi Prioritas

| Paket | Fase | Durasi | Cocok Untuk |
|-------|------|--------|-------------|
| ⚡ **MVP** | P1 + P2 + P3 | ~3,5 jam | Ingin Topic Router + Dashboard Overview segera |
| ✅ **Rekomendasi** | MVP + P4 | ~5 jam | Ingin semua fitur fungsional kecuali 3D |
| 🏆 **Premium Penuh** | Rekomendasi + P5 + P6 | ~7 jam | Ingin complete experience |

### Timeline Detail

| Minggu | Hari | Fase | Fokus |
|--------|------|------|-------|
| 1 | 1 | P1 | Data Layer — agent_log.db + content_db |
| 1 | 2 | P2 | Topic Router — plugin + test routing |
| 1-2 | 3-5 | P3 | Dashboard 2.0 — tabs + overview + agents |
| 2 | 6-7 | P4 | Chat + Schedule + Content tabs |
| 2-3 | 8-9 | P5 | Office 3D + Token + Tailscale |
| 3 | 10 | P6 | Dokumen + smoke test + deploy |

---

## 10. Lampiran

### A. Struktur File Baru

```
niu-mission-control/
├── server.py              # ✅ Existing — diperluas dengan endpoint baru
├── dashboard/
│   ├── index.html         # ✅ Existing — redirect ke /overview
│   ├── nav.html           # 🔧 Baru — navigasi tab
│   ├── overview.html      # 🔧 Baru — Overview tab
│   ├── agents.html        # 🔧 Baru — Agents tab + heatmap
│   ├── office.html        # 🔧 Baru — Office 3D tab
│   ├── chat.html          # 🔧 Baru — Chat tab
│   ├── tasks.html         # 🔧 Baru — Kanban (wrapper iframe)
│   ├── content.html       # 🔧 Baru — Content library tab
│   ├── schedule.html      # 🔧 Baru — Schedule tab
│   ├── projects.html      # ✅ Existing — Project health tab
│   ├── docs.html          # 🔧 Baru — Documentation tab
│   ├── css/               # 🔧 Baru — CSS bersama
│   └── js/                # 🔧 Baru — JS bersama
├── modules/
│   ├── agent_log.py       # 🔧 Baru — Activity logging
│   ├── content_db.py      # 🔧 Baru — Content library
│   ├── telegram_router.py # 🔧 Baru — Topic router plugin
│   └── hermes_bridge.py   # 🔧 Baru — Hermes API bridge
├── scripts/               # ✅ Existing — tidak berubah
├── agents/                # ✅ Existing — tidak berubah
├── DOX/
│   ├── AGENTS.md          # ✅ Existing — update dengan arsitektur baru
│   ├── MASTERPLAN.md      # 🔧 Baru — dokumen ini
│   ├── PLAN.md            # ✅ Existing — rencana v1
│   ├── RUNBOOK.md         # ✅ Existing — update dengan komponen baru
│   ├── PRD.md             # 🔧 Baru — project-foundation
│   ├── TECHSPEC.md        # 🔧 Baru — project-foundation
│   ├── UX.md              # 🔧 Baru — project-foundation
│   ├── TIMELINE.md        # 🔧 Baru — project-foundation
│   ├── TESTING.md         # 🔧 Baru — project-foundation
│   └── DEPLOY.md          # 🔧 Baru — project-foundation
├── data/                  # 🔧 Baru — Runtime data
│   ├── agent_log.db       # 🔧 Dibuat saat runtime
│   └── contents/          # 🔧 Dibuat saat runtime
│       ├── builder/
│       ├── pengawas/
│       ├── arsitek/
│       ├── penjaga/
│       ├── scribe/
│       └── reach/
└── plugins/               # 🔧 Baru — Hermes plugins
    └── telegram_router/
        ├── __init__.py
        └── config.yaml
```

### B. Skill yang Dipakai Selama Migrasi

| Skill | Fase | Kegunaan |
|-------|------|----------|
| `project-foundation` | P6 | Template 6 dokumen inti |
| `writing-plans` | Semua | Task breakdown tiap fase |
| `architecture-diagram` | Perencanaan | Diagram arsitektur |
| `project-orientation` | P6 | Audit existing docs |
| `plan-compliance-audit` | P6 | Verify plan compliance |

### C. Referensi Tutorial

| Sumber | Link | Kegunaan |
|--------|------|----------|
| **YouTube (video)** | https://www.youtube.com/watch?v=Iup815Xz_ZU | Walkthrough 1 jam 17 menit |
| **Website (teks)** | https://komputermechanic.com/tutorials/hermes-mission-control | Versi teks + prompt |
| **Prompt pack** | $7 (37 prompts .md + dashboard template) | Opsional — kita adaptasi, jangan copy mentah |

### D. Glosarium

| Istilah | Arti |
|---------|------|
| **Topic ID** | `message_thread_id` Telegram — pengenal unik untuk setiap topic dalam group |
| **Topic Router** | Plugin yang mendeteksi Topic ID dan merutekan pesan ke agent yang sesuai |
| **Agent Log** | Database SQLite yang mencatat semua aktivitas agent |
| **Content Library** | Sistem penyimpanan dokumen per agent di folder `data/contents/` |
| **Hermes Bridge** | Jembatan API antara dashboard web dan Hermes Agent |
| **Office 3D** | Visualisasi 3D agent status menggunakan Three.js |
| **Zero Destruction** | Prinsip: tidak ada kode existing yang dihapus atau dimodifikasi |
| **Phase Gate** | Checkpoint di akhir setiap fase untuk verifikasi sebelum lanjut |

---

## 11. Dokumen Turunan

Detail teknis, spesifikasi, dan panduan operasional tersedia di direktori `DOX/`:

| Dokumen | Isi | Status |
|---------|-----|--------|
| [PRD](DOX/PRD.md) | Kebutuhan fitur, metrik sukses, stakeholders | ✅ Selesai |
| [TECHSPEC](DOX/TECHSPEC.md) | Arsitektur, API contracts, data models, tech stack | ✅ Selesai |
| [UX](DOX/UX.md) | Alur pengguna, wireframe, edge cases | ✅ Selesai |
| [TIMELINE](DOX/TIMELINE.md) | Jadwal fase, milestone, dependensi tugas | ✅ Selesai |
| [TESTING](DOX/TESTING.md) | Kriteria penerimaan, skenario uji, performance budget | ✅ Selesai |
| [DEPLOY](DOX/DEPLOY.md) | CI/CD, rollback, monitoring, runbook | ✅ Selesai |

---

*Rencana Induk v2.1 — 17 Juli 2026*
*Ditulis setelah mempelajari tutorial Komputer Mechanic (1j 17m) + audit penuh ekosistem Niu-MC existing*
*Semua konten dalam Bahasa Indonesia sesuai instruksi*

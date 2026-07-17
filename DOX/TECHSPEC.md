# Spesifikasi Teknis: Niu-MissionControl Evolution

> **Status:** Final
> **Tech Stack:** Python + Vanilla JS + SQLite + Chart.js
> **Diperbarui:** 17 Juli 2026
> **Dokumen Terkait:** PRD.md, MASTERPLAN.md

---

## 1. Tech Stack

| Komponen | Teknologi | Versi | Rasional |
|----------|-----------|-------|----------|
| **Bahasa Server** | Python | 3.11+ | Sudah berjalan, tidak perlu ganti. http.server built-in |
| **Frontend** | Vanilla JS + CSS | - | Tanpa framework berat. Cukup untuk dashboard monitoring |
| **Database** | SQLite | 3.x | Ringan, tanpa server, file-based. Cocok untuk single-user |
| **Diagram** | Chart.js | 4.x (CDN) | Gratis, ringan, heatmap + pie chart support |
| **3D Visual** | Three.js | r128 (CDN) | Opsional — fallback CSS jika GPU tidak support |
| **Remote Access** | Tailscale | Latest | Free tier, zero-config tunnel, tidak perlu buka port |
| **Telegram Bot** | python-telegram-bot / HTTP API | Latest | Interface dengan Telegram |
| **Hermes Agent** | Hermes (framework) | Latest | Orkestrator utama |
| **Version Control** | Git + GitHub | - | Backup konfigurasi, kolaborasi |
| **Hosting** | macOS lokal (HermesAgent USB) | - | Tidak ada VPS. Semua lokal |

---

## 2. Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────┐
│                    MACOS (LOKAL)                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Hermes Agent (Gateway)                 │   │
│  │  opencode-zen/big-pickle → openrouter fallback   │   │
│  └────────────────┬─────────────────────────────────┘   │
│                   │                                      │
│  ┌────────────────▼─────────────────────────────────┐   │
│  │           Niu-MC Server (Python)                  │   │
│  │           Port 5200 — http.server                 │   │
│  │                                                   │   │
│  │  ┌──── API ────┐  ┌────── Tab ──────┐            │   │
│  │  │ /api/mc/    │  │ /overview       │            │   │
│  │  │ aggregated  │  │ /agents         │            │   │
│  │  │ /activity   │  │ /office         │            │   │
│  │  │ /activity/  │  │ /chat           │            │   │
│  │  │   stats     │  │ /tasks          │            │   │
│  │  │ /system     │  │ /content        │            │   │
│  │  │ /agents     │  │ /schedule       │            │   │
│  │  │ /cron       │  │ /projects       │            │   │
│  │  │ /gateway    │  │ /docs           │            │   │
│  │  │ /projects   │  └─────────────────┘            │   │
│  │  │ /chat       │                                  │   │
│  │  │ /tokens     │                                  │   │
│  │  │ /cron/run   │                                  │   │
│  │  └─────────────┘                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                   │                                      │
│  ┌────────────────▼─────────────────────────────────┐   │
│  │              DATA LAYER                           │   │
│  │                                                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │   │
│  │  │kanban.db │  │agent_log │  │ content.db     │ │   │
│  │  │(EXISTING)│  │ .db      │  │ (NEW)          │ │   │
│  │  │          │  │ (NEW)    │  │ dokumen per    │ │   │
│  │  │tasks     │  │activity  │  │ agent          │ │   │
│  │  └──────────┘  └──────────┘  └────────────────┘ │   │
│  │  ┌──────────┐  ┌──────────┐                      │   │
│  │  │state.db  │  │filesystem│                      │   │
│  │  │(EXISTING)│  │contents/ │                      │   │
│  │  │cron jobs │  │ (NEW)    │                      │   │
│  │  └──────────┘  └──────────┘                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │            TELEGRAM (EXTERNAL)                    │   │
│  │  Niu-MissionControl Group                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │   │
│  │  │#general  │  │#dev      │  │#audit    │       │   │
│  │  │orch.     │  │builder   │  │pengawas  │       │   │
│  │  └──────────┘  └──────────┘  └──────────┘       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Alur Data: Chat dari Dashboard

```
Browser → POST /api/mc/chat {agent: "builder", message: "..."}
  → server.py handle POST
  → panggil hermes_chat() → subprocess hermes CLI
  → hermes proses via Gateway → OpenRouter → model
  → response balik
  → log ke agent_log.db
  → return JSON ke browser
```

### Alur Data: Activity Log

```
Setiap agent selesai task:
  → panggil agent_log.log(agent, task, model, status, tokens)
  → INSERT ke agent_log.db
  → Dashboard Overview poll /api/mc/activity setiap 30 detik
  → tampil di Recent Activity feed
```

---

## 3. API Contracts

### Endpoint Existing (tidak berubah)

Semua endpoint di `server.py` yang sudah ada tetap berfungsi tanpa perubahan:

| Path | Method | Response | Keterangan |
|------|--------|----------|------------|
| `/api/mc/aggregated` | GET | JSON | Aggregator semua data |
| `/api/mc/system` | GET | JSON | CPU, RAM, Disk |
| `/api/mc/agents` | GET | JSON | Status agent |
| `/api/mc/cron` | GET | JSON | Cron job list |
| `/api/mc/projects` | GET | JSON | Git health |
| `/api/mc/gateway` | GET | JSON | Gateway status |

### Endpoint Baru

#### `GET /api/mc/activity`

**Response:**
```json
[
  {
    "id": 1,
    "agent": "builder",
    "task": "implementasi fitur X",
    "model": "claude-sonnet-4",
    "status": "success",
    "tokens_in": 1500,
    "tokens_out": 800,
    "duration_ms": 45000,
    "created_at": "2026-07-17 14:30:00"
  }
]
```

#### `GET /api/mc/activity/stats`

**Response:**
```json
{
  "total": 42,
  "by_agent": {"builder": 15, "pengawas": 10, "arsitek": 8, "penjaga": 5, "scribe": 3, "reach": 1},
  "by_status": {"success": 38, "failed": 2, "pending": 2},
  "tokens": {"in": 52000, "out": 28000}
}
```

#### `POST /api/mc/chat`

**Request:**
```json
{
  "agent": "builder",
  "message": "Tolong cek error di log"
}
```

**Response:**
```json
{
  "response": "Sudah saya cek. Error ada di line 42...",
  "agent": "builder",
  "status": "success"
}
```

#### `POST /api/mc/cron/run/<job_id>`

**Response:**
```json
{
  "status": "triggered",
  "job_id": "abc123"
}
```

#### `GET /api/mc/tokens`

**Response:**
```json
{
  "total_in": 52000,
  "total_out": 28000,
  "by_model": {
    "gemini-2.5-flash": {"in": 30000, "out": 15000},
    "claude-sonnet-4": {"in": 22000, "out": 13000}
  }
}
```

#### `GET /api/mc/content`

**Response:**
```json
[
  {
    "id": 1,
    "agent": "scribe",
    "title": "Panduan API SPLP",
    "filename": "2026-07-17-panduan-api-splp.md",
    "word_count": 1500,
    "created_at": "2026-07-17 16:00:00"
  }
]
```

### Error Codes

| Code | HTTP Status | Arti |
|------|-------------|------|
| `AGENT_OFFLINE` | 503 | Hermes/agent tidak tersedia |
| `JOB_NOT_FOUND` | 404 | Cron job ID tidak ditemukan |
| `INVALID_AGENT` | 400 | Nama agent tidak dikenal |
| `DB_ERROR` | 500 | Database error |
| `TIMEOUT` | 504 | Hermes gateway timeout |

---

## 4. Data Models

### 4.1 agent_log.db — Tabel `agent_log`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | INTEGER | PK, AUTOINCREMENT | |
| agent | TEXT | NOT NULL | builder, pengawas, arsitek, penjaga, scribe, reach |
| task | TEXT | NOT NULL | Deskripsi tugas |
| model | TEXT | NULLABLE | Model AI yang dipakai |
| status | TEXT | DEFAULT 'pending' | success, failed, pending |
| tokens_in | INTEGER | DEFAULT 0 | Input token count |
| tokens_out | INTEGER | DEFAULT 0 | Output token count |
| duration_ms | INTEGER | NULLABLE | Waktu eksekusi dalam ms |
| created_at | TEXT | DEFAULT datetime('now') | ISO format timestamp |
| metadata | TEXT | NULLABLE | JSON blob untuk data tambahan |

**Index:** `(agent)`, `(created_at)`

### 4.2 content.db — Tabel `content`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | INTEGER | PK, AUTOINCREMENT | |
| agent | TEXT | NOT NULL | builder, pengawas, etc |
| title | TEXT | NULLABLE | Judul dokumen |
| filename | TEXT | NULLABLE | Nama file |
| filepath | TEXT | NULLABLE | Path lengkap |
| word_count | INTEGER | DEFAULT 0 | Jumlah kata |
| created_at | TEXT | DEFAULT datetime('now') | |

**Index:** `(agent)`

### 4.3 Struktur Folder Data

```
data/
├── agent_log.db          # SQLite — activity log
├── content.db            # SQLite — metadata konten
└── contents/             # File dokumen aktual
    ├── builder/
    │   └── 2026-07-17-implementasi-fitur-x.md
    ├── pengawas/
    ├── arsitek/
    ├── penjaga/
    ├── scribe/
    └── reach/
```

---

## 5. Struktur Direktori

```
niu-mission-control/
├── server.py                  # Server HTTP utama (EXISTING + EXTENDED)
├── dashboard/
│   ├── index.html             # Redirect ke /overview (EXISTING, diubah)
│   ├── nav.html               # Navigasi tab (BARU)
│   ├── overview.html          # Overview tab (BARU)
│   ├── agents.html            # Agents tab (BARU)
│   ├── office.html            # Office 3D tab (BARU)
│   ├── chat.html              # Chat tab (BARU)
│   ├── tasks.html             # Kanban iframe (BARU)
│   ├── content.html           # Content tab (BARU)
│   ├── schedule.html          # Schedule tab (BARU)
│   ├── projects.html          # Project health (EXISTING)
│   ├── docs.html              # Documentation tab (BARU)
│   ├── css/                   # Stylesheets (BARU)
│   └── js/                    # JavaScript (BARU)
├── modules/
│   ├── agent_log.py           # Activity logging (BARU)
│   ├── content_db.py          # Content library (BARU)
│   ├── telegram_router.py     # Topic router (BARU)
│   └── hermes_bridge.py       # Hermes API bridge (BARU)
├── scripts/                   # Script existing (TIDAK BERUBAH)
├── agents/                    # Definisi agent (TIDAK BERUBAH)
├── DOX/                       # Dokumentasi
│   ├── MASTERPLAN.md
│   ├── PRD.md
│   ├── TECHSPEC.md
│   ├── UX.md
│   ├── TIMELINE.md
│   ├── TESTING.md
│   ├── DEPLOY.md
│   ├── AGENTS.md
│   ├── ORCHESTRATOR.md
│   ├── RUNBOOK.md
│   └── PLAN.md
├── data/                      # Runtime data (BARU)
│   ├── agent_log.db
│   ├── content.db
│   └── contents/
│       ├── builder/
│       ├── pengawas/
│       ├── arsitek/
│       ├── penjaga/
│       ├── scribe/
│       └── reach/
└── plugins/                   # Hermes plugins (BARU)
    └── telegram_router/
        ├── __init__.py
        └── config.yaml
```

---

## 6. Dependensi

| Paket | Versi Minimal | Lisensi | Tujuan |
|-------|---------------|---------|--------|
| Python | 3.11 | PSF | Runtime server |
| SQLite3 | 3.x (built-in) | Public Domain | Database |
| Chart.js | 4.x (CDN) | MIT | Heatmap, charts |
| Three.js | r128 (CDN) | MIT | 3D Office (opsional) |
| Tailscale | Latest (brew) | BSD | Remote access |
| python-telegram-bot | 20.x | GPL-3 | Telegram API (untuk plugin) |
| hermes | Latest | MIT | Orkestrator AI |

---

## 7. Keamanan

| Aspek | Pendekatan |
|-------|-----------|
| **Autentikasi** | Tidak ada (hanya akses via Tailscale pribadi) |
| **Secrets Management** | Environment variables di `~/.hermes/config.yaml` |
| **Data Protection** | Semua data lokal di SQLite. Tidak ada data sensitif pengguna |
| **Network Security** | Dashboard listen di `0.0.0.0:5200` tapi hanya bisa diakses via Tailscale tunnel |
| **Input Validation** | Sanitasi input chat (escaping) sebelum dikirim ke Hermes CLI |
| **SQL Injection** | Tidak relevan — parameterized query via sqlite3 already |
| **XSS** | Minimal risk — dashboard single-user, tapi tetap escape HTML output |
| **Plugin Security** | Topic router hanya berjalan di Hermes Agent lokal |

---

*Dokumen ini mengikuti template project-foundation skill.*

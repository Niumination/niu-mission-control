# 🎮 Niu-MissionControl — Ecosystem Dashboard

> **Status:** P3 🆕 — 40% matang | Active Development
> **Path:** `~/Desktop/Niumination/projects/niu-mission-control/`
> **Server:** `python3 server.py` → `http://localhost:5200`
> **Kanban:** `http://localhost:5199` (separate service)

---

## 📋 Quick Start

```bash
# Jalankan server dashboard
python3 server.py

# Akses
open http://localhost:5200

# Periksa status sistem
curl http://localhost:5200/api/mc/system | jq .
```

---

## 🏗️ Struktur Proyek

```
projects/niu-mission-control/
├── server.py              # HTTP server (port 5200) — semua API endpoint
├── dashboard/
│   ├── index.html         # Main dashboard UI
│   ├── dashboard.js       # Tab logic & widget renderers
│   ├── tabs/               # Fragment HTML per tab (overview, agents, chat, dll)
│   └── models/             # 3D model output (sculptor)
├── modules/
│   ├── agent_log.py        # SQLite activity log
│   ├── content_db.py       # SQLite document library
│   └── hermes_bridge.py    # Telegram chat + terminal bridge
├── scripts/
│   ├── agent-runner.sh     # Persistent agent terminal
│   ├── aggregator.sh       # Merged JSON collector
│   �── get-agents.py       # Agent status widget
│   ├── get-cron.py         # Cron health widget
│   ├── get-gateway.py      # Gateway health widget
│   ├── get-git.py          # Project git health widget
│   ├── get-system.py       # System health widget
│   ├── health-check.py     # Silent health checker
│   └── sculptor_wrapper.py # 3D sculptor wrapper
├── data/
│   ├── agent_log.db        # Activity SQLite
│   ├── content.db          # Content SQLite
│   └── contents/            # Document files
├── DOX/                    # Master docs (AGENTS.md, MASTERPLAN.md, PRD.md, dll)
├── plugins/telegram_router # Telegram plugin
├── tools/threejs-sculptor  # 3D sculptor
└── AGENTS.md               # Agent fleet roster
```

---

## 🤖 Agent Fleet

Lihat `AGENTS.md` untuk detail persona:

| Alias | Peran | Fungsi Utama |
|-------|-------|-------------|
| `builder` / `pembangun` | Developer | Kode, build, deploy |
| `pengawas` | Reviewer | Audit, quality gate |
| `arsitek` | Architect | Desain arsitektur, spec |
| `penjaga` | Guardian | Health, monitoring, backup |
| `scribe` | Writer | Dokumentasi, DOX, changelog |
| `reach` | Connector | Social, outreach, koordinasi |

---

## 🔌 API Endpoints

Semua endpoint mengembalikan JSON:

| Endpoint | Metode | Deskripsi |
|----------|--------|-----------|
| `/api/mc/system` | GET | System health (disk, memory, uptime) |
| `/api/mc/agents` | GET | Agent fleet status |
| `/api/mc/gateway` | GET | Gateway & launchd status |
| `/api/mc/cron` | GET | Cron job list & health |
| `/api/mc/activity` | GET | Recent agent activity log |
| `/api/mc/activity/stats` | GET | Activity heatmap data |
| `/api/mc/aggregated` | GET | Merged ecosystem summary |
| `/api/mc/projects` | GET | Git repo health across Production/projects |
| `/api/mc/content` | GET | Content DB (optional `?agent=` filter) |
| `/api/mc/tokens` | GET | Token usage breakdown |
| `/api/mc/chat` | POST | Send chat via Hermes (`{"text":"...","topic_id":"1"}`) |
| `/api/mc/terminal` | POST | Execute shell (`{"cmd":"ls -la"}`) |
| `/api/mc/sculpt` | POST | 3D sculptor (`{"image":"path","object_name":"..."}`) |
| `/api/stats` | GET | Kanban stats (proxy to localhost:5199) |
| `/api/tasks` | GET | Kanban tasks (proxy) |

---

## 🧪 Testing

```bash
# Server status
curl -s -o /dev/null -w "%{http_code}" http://localhost:5200/

# API smoke test
for endpoint in /api/mc/system /api/mc/agents /api/mc/gateway /api/mc/cron; do
  echo -n "$endpoint: "
  curl -s -o /dev/null -w "%{http_code}" "http://localhost:5200$endpoint"
  echo
done
```

---

## 📚 Referensi Dokumen

- `DOX/AGENTS.md` — Agent persona guide
- `DOX/MASTERPLAN.md` — Master plan (1159 baris)
- `DOX/PRD.md` — Product Requirements
- `DOX/TECHSPEC.md` — Technical Specification
- `DOX/TESTING.md` — Testing & QA
- `DOX/DEPLOY.md` — Deployment guide
- `DOX/UX.md` — User flow & wireframes

---

## ⚡ Status & Prioritas

- **Fase:** P3 (40% matang)
- **Server:** ✅ Berfungsi (port 5200)
- **API:** ✅ Semua endpoint utama aktif
- **Dashboard UI:** ✅ Tab overview, agents, chat, schedule, content, office, tasks, projects, docs
- **Kanban:** Terhubung via proxy (`localhost:5199`)
- **Skrip:** ✅ `aggregator.sh`, `get-*.py`, `agent-runner.sh`
- **Dokumen:** ✅ Lengkap di `DOX/`

---

*Dibuat: 22 Jul 2026 | Niu-MissionControl — Niumination Ecosystem*

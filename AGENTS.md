# Niu-MissionControl — Unified Command Center

**Lokasi:** `~/Desktop/Niumination/services/niu-mission-control/`
**Port:** 5200 (localhost)
**Stack:** Python 3, FastAPI, WebSocket, psutil, aiosqlite
**Version:** 2.6.0

## Visi

Single Pane of Glass untuk seluruh Niumination Ecosystem — menggabungkan Hermes Agent Swarm monitoring, Mac system health, Ecosystem overview (39+ proyek), Cron jobs monitoring, dan Git activity dalam satu dashboard.

## Arsitektur

```
niu-mission-control/
├── server.py                    ← FastAPI server (port 5200)
├── modules/
│   ├── ecosystem_scanner.py     ← Scan struktur baru (apps/sites/desktop/labs/services/sandbox/agents/tools), git, launchd
│   ├── gateway_log_parser.py    ← Telegram feed dari Hermes state.db
│   ├── hermes_bridge.py         ← Hermes CLI bridge (send, terminal)
│   └── hermes_status.py         ← Gateway + cron status (subprocess)
├── swarm/
│   ├── agents.py                ← Agent config (chief, research, programmer, qa)
│   ├── bus.py                   ← SwarmBus: aiosqlite + asyncio.Queue + WAL
│   └── worker.py                ← Parallel asyncio loops per agent
├── dashboard/
│   ├── index.html               ← 8 pages: Dashboard, Ecosystem, Swarm, Task, Terminal, TG, USB, Config
│   ├── styles.css               ← Deep Space Cybernetic HUD theme (~2050 lines)
│   └── app.js                   ← WebSocket client + all page renderers (~1100 lines)
└── data/
    └── swarm_config.json        ← Runtime config (LLM model, concurrency, etc)
```

## Dashboard Pages

| # | Page | ID | Fungsi |
|---|------|----|--------|
| 1 | Dashboard | `page-dashboard` | KPI cards, agent fleet, TG bridge, terminal matrix, kanban, artifacts |
| 2 | **Ecosystem** | `page-ecosystem` | 4 tabs: Projects (30), Mac System, Cron Jobs (8), Git Activity |
| 3 | Swarm Topology | `page-swarm` | Agent config, system prompts, topology map |
| 4 | Task Kanban | `page-taskqueue` | Mission dispatch, workflow grid |
| 5 | Terminal Hub | `page-terminal` | Interactive shell, predefined commands |
| 6 | Telegram Bridge | `page-telegram` | Architecture info, topic sender |
| 7 | USB & Storage | `page-storage` | Volumes, RAM disk, WAL metrics |
| 8 | System Config | `page-system` | Swarm config editor, Hermes cron table |

## API Endpoints

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/health` | GET | Health check (public) |
| `/api/mc/system` | GET | Mac system: CPU, RAM, disk, swap, uptime, network, top processes |
| `/api/mc/hermes` | GET | Hermes gateway + cron status (subprocess, 10s timeout) |
| `/api/mc/ecosystem` | GET | **NEW** — Full ecosystem: projects, cron, git, backlog |
| `/api/mc/ecosystem?type=projects` | GET | Projects only (struktur baru scan) |
| `/api/mc/ecosystem?type=cron` | GET | LaunchD cron jobs only |
| `/api/mc/ecosystem?type=git` | GET | Git activity only |
| `/api/mc/ecosystem?type=backlog` | GET | BACKLOG.md task counts only |
| `/api/mc/agents` | GET | Agent swarm status |
| `/api/mc/tasks` | GET | Task kanban |
| `/api/mc/telegram-feed` | GET | Telegram messages dari Hermes state.db |
| `/api/mc/send-telegram` | POST | Send message ke Telegram topic |
| `/api/mc/delegate` | POST | Delegate task ke agent |
| `/api/mc/run-terminal` | POST | Execute shell command |
| `/api/mc/artifacts` | GET | List artifact files |
| `/api/mc/config` | GET/POST | Swarm config |
| `/ws/swarm` | WS | Live agent + terminal stream |

## Ecosystem Scanner

`modules/ecosystem_scanner.py` — scan seluruh Niumination ecosystem:
- **39 projects** dari struktur baru: `apps/` (12), `sites/` (5), `desktop/` (3), `services/` (6), `labs/` (2), `sandbox/` (5), `agents/` (3), `tools/` (1), `dotfiles/` (1), `brain/` (1)
- Git metadata: branch, last commit (hash, msg, date), dirty, unpushed count
- **LaunchD cron jobs** — `com.niumation.*.plist` **sudah DIHAPUS 5 Agu 2026** (0 jobs) — scanner harus handle kosong
- **39 git repos** dengan recent commits (3 per repo)
- BACKLOG.md parser: total/done/active/p1/p2/p3

## Data Sources

| Data | Source | Endpoint |
|------|--------|----------|
| Projects | Filesystem scan struktur baru (`apps/`, `sites/`, `desktop/`, `labs/`, `services/`, `sandbox/`, `agents/`, `tools/`) | `/api/mc/ecosystem` |
| Git status | `git log`, `git status`, `git remote` per repo | `/api/mc/ecosystem` |
| Mac system | psutil (CPU, RAM, disk, swap, network, processes) | `/api/mc/system` |
| Cron (macOS) | `~/Library/LaunchAgents/com.niumation.*.plist` — **kosong sejak 5 Agu** | `/api/mc/ecosystem?type=cron` |
| Cron (Hermes) | `hermes cron list` (subprocess, 10s timeout) — 1 job aktif (memory-checkpoint) | `/api/mc/hermes` |
| Crontab | `crontab -l` — 1 entry (sync-to-agents.sh tiap 6 jam) | — |
| Telegram | Hermes `state.db` (SQLite sessions + messages) | `/api/mc/telegram-feed` |
| Backlog | `BACKLOG.md` regex parsing | `/api/mc/ecosystem?type=backlog` |

## Sync Fixes v2.1 (30 Jul 2026)

**Root cause dashboard tidak sync dengan bank skill:**

1. **Permanent cache** — `skill_monitor.py:_scan_skill_bank()` caches skill list FOREVER setelah first call (`if SKILL_CACHE is not None: return`). Skills baru ditambahkan ke bank tidak akan muncul sampai server restart.
   - Fix: Ganti dengan TTL cache 30s, auto-refresh dari disk setiap request setelah TTL expire.

2. **Auto-seed** — Tidak ada mekanisme seed awal. sync-to-agents.sh POST events ke MC, tapi jika MC down events silent fail. 15 dari 29 skills tidak terdaftar di database.
   - Fix: `_seed_all_skills()` jalan di `init_db()` dan di `notify_sync_completed()`, menjamin semua skill bank terdaftar di DB.

3. **Ecosystem scanner salah path** — `Production/` dan `projects/` tidak ada di v4.0. Yang benar: `apps/`, `services/`, `sites/`, `desktop/`, `agents/`, `labs/`, `sandbox/`.
   - Fix: SCAN_DIRS di-update. Status label, sort order, filter di dashboard ikut di-update.

4. **SKILL_TRIGGER_MAP hardcoded** — Hanya 13 dari 29 skills punya trigger entry di dashboard.
   - Fix: Lengkapi semua 29 skills dengan direct command dan trigger keywords.

## Known Issues

- Gateway status butuh ~7-8 detik (subprocess timeout di-setting 10s)
- Telegram interactive chat dari dashboard belum sempurna
- Swarm topology belum diuji ke proyek spesifik

## Changelog

### v2.6.1 (30 Jul 2026)
- **fix**: Permanent cache di skill_monitor.py — ganti TTL 30s, auto-refresh
- **fix**: Auto-seed semua 29 skills bank ke DB di startup + setiap sync
- **fix**: Ecosystem scanner SCAN_DIRS ke v4.0 (apps, services, sites, desktop, agents, labs, sandbox)
- **fix**: SKILL_TRIGGER_MAP dashboard — dari 13 jadi 29 skills (complete)
- **fix**: Filter eco projects — dari Production/projects ke maturity pipeline

### v2.6.0 (25 Jul 2026)
- feat: Ecosystem Overview page (4 tabs: Projects, Mac, Cron, Git)
- feat: `/api/mc/ecosystem` endpoint — scan 30 projects, 8 cron, 30 git repos
- feat: Enhanced `/api/mc/system` — top processes, uptime, network, swap
- feat: Sidebar toggle (hamburger button)
- fix: Gateway status timeout 5→10s + WS-vs-HTTP conflict resolved

### v2.5.1 (24 Jul 2026)
- Initial production version
- 7 dashboard pages, WebSocket, Telegram bridge, terminal hub

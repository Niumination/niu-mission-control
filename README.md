# Niumination Mission Control v4.1 Aether Sync

**Personal AI OS Dashboard** — self-hosted AI agent control plane untuk swarm 5 agent, visual orb + reasoning web hidup, **sinkron dengan Ekosistem Niumination v4.0 DOX + gold standard Next.js 16**. Rebuild dari APEX-UI (MIT).

## 🚀 Quick Start

```bash
# 0. Aktifkan DOX gate (Wajib di clone baru)
git config core.hooksPath .githooks

# 1. Install (Node 22 via .nvmrc)
cd apex-ui && npm install

# 2. Dev (localhost:3000, webpack mode — Next 16)
npm run dev
# First-run → /setup → password → Initialize → .env.local auto-generated
# Login dengan password tersebut

# 3. Production
npm run build && npm start
# Atau standalone: node .next/standalone/server.js

# 4. Docker (multi-stage, node:22-alpine)
docker build -f apex-ui/deploy/Dockerfile -t niu-mission-control:4.1 .
docker compose -f apex-ui/deploy/docker-compose.yml up -d
curl http://localhost:3000/api/mc/health
curl http://localhost:3000/api/v1/mc/health  # v1 alias

# 5. Test
npm run test          # vitest 12/12
MC_PASSWORD=apex node scripts/test-sse.mjs  # SSE 10/10
node tests/e2e/a11y.mjs  # a11y 7 routes
```

**Dev password jika sudah ada:** `apex` (atau cek `.env.local`).

## 🏗️ Arsitektur v4.0

| Layer | Teknologi | Status |
|-------|-----------|--------|
| Frontend | Next.js 15 + React 19 + Tailwind 4 + Zustand + dnd-kit + cmdk | ✅ |
| Orb | SVG hand-written + R3F particle core + WebGL shader, reacts to SSE | ✅ Living |
| Reasoning Web | SVG 5-agent graph, particle flow, node glow saat working | ✅ Living |
| API | Next.js Route Handlers `/api/mc/*` (14 endpoints) + Zod + auth middleware | ✅ |
| DB | SQLite WAL + better-sqlite3 + migrations 001_initial (11 tables) | ✅ |
| Realtime | SSE `/api/mc/events` + EventBus in-process singleton + Last-Event-ID replay | ✅ |
| Dispatcher | Worker loop 3s, claim atomic, retry/backoff exponential, dead-letter, graceful shutdown 30s | ✅ |
| Adapters | Mock (dev) + Hermes CLI (prod) + registry extensible | ✅ |
| Auth | Session cookie httpOnly + API key + middleware | ✅ |
| Observability | Cost tracking, system_logs, audit_log immutable, metrics, logs | ✅ |
| Backup | VACUUM INTO daily 3AM, retention 30d, scheduler, manual trigger, download API | ✅ |
| Deploy | Dockerfile multi-stage + docker-compose + LaunchAgent + systemd + start.sh | ✅ |
| UI Polish | ErrorBoundary, Skeleton shimmer, EmptyState, Toast, AppShell collapsible, CommandPalette ⌘K | ✅ |

## 👥 Swarm (5 Agents)

| Agent | ID | Role | Status | Adapter |
|-------|----|------|--------|---------|
| Hermes Chief | chief | Orchestrator & Leader | Online/Working | mock (dev) |
| Research | research | Research & Learn | Offline/Idle | hermes |
| Programmer | programmer | Programmer & Coder | Offline/Idle | hermes |
| QA Tester | qa | Tester & QA | Offline/Idle | hermes |
| Kreator | creator | Content Creator | Offline/Idle | hermes |

Seed otomatis jika DB kosong. Edit di `/agents` → Config tab.

## 📁 Struktur

```
niu-mission-control/
├── apex-ui/                  # Main Next.js app
│   ├── app/(app)/            # Protected: Overview, Missions Kanban, Agents, Live Ops, Analytics, Audit, Settings
│   ├── app/api/mc/           # 14 API routes: health, agents, tasks, dispatch, approvals, events SSE, logs, metrics, audit, settings, backups, telegram
│   ├── components/           # kanban, agents, live-ops, analytics, shell, ui (Toast, ErrorBoundary, Skeleton, EmptyState)
│   ├── lib/server/           # db, state-machine, dispatcher, events, adapters, auth, logger, backup, bootstrap
│   ├── lib/client/           # Zustand stores, SSE hook, transitions mirror
│   ├── migrations/001_initial.sql
│   ├── scripts/backup.ts, test-sse.mjs
│   ├── deploy/Dockerfile, docker-compose.yml, plist, systemd, start.sh
│   └── README.md             # Detailed docs
├── data/                     # SQLite DB + backups (gitignored, volume in Docker)
│   └── swarm_state.db
├── docs/
│   ├── PRD.md                # v4.0 Product Requirements (11 milestones)
│   ├── API.md                # API spec 14 endpoints + event types + security
│   ├── ORCHESTRATION.md      # State machine, dispatcher, adapters, approval, event bus, backup, logging, graceful shutdown, deploy, polish
│   ├── adr/                  # Architecture Decision Records
│   └── STATUS.md             # Milestone tracking
├── .env.example
└── README.md (this file)
```

## 🔄 Task Lifecycle

```
inbox → queued → running → review → done
                 ↘ failed → queued (retry) / cancelled
```

Drag & drop di `/missions` Kanban (6 kolom) dengan validasi client+server (409 jika ilegal) + optimistic update + SSE revert. Klik card → TaskInspector slide-over dengan metadata, result/error, actions (Start, Submit, Approve, Reject, Retry, Cancel).

## 📡 Realtime

- SSE `GET /api/mc/events` → `text/event-stream`, replay via `Last-Event-ID`
- EventBus singleton via `globalThis` survive HMR
- Client `useEventStream()` sekali di shell layout, update Zustand
- Orb pulse sesuai beban swarm, ReasoningWeb node glow saat working

## 🔐 Security

- Auth selalu-on, password hash scrypt, session httpOnly secure sameSite strict, API key timing-safe
- Zod validation 100% POST/PATCH
- Shell exec hanya via adapter, execFile array args, shell=false, cwd locked
- Secrets dari env, fail-fast, CSP headers, audit log immutable append-only, WAL + foreign_keys ON + transaction

## 💾 Backup & Deploy

- Backup: VACUUM INTO daily 3AM, retention 30d, `POST /api/mc/backups` manual, `GET /api/mc/backups/:name` download, Settings → Backup tab
- Docker: `docker build -f apex-ui/deploy/Dockerfile -t niu-mission-control:4.0 . && docker compose -f apex-ui/deploy/docker-compose.yml up -d`
- LaunchAgent macOS: `cp apex-ui/deploy/com.niumination.missioncontrol.plist ~/Library/LaunchAgents/ && launchctl load ... && launchctl start ...` — auto-restart on crash (KeepAlive), logs di `/opt/niu-mission-control/logs/`
- systemd Linux: `sudo cp apex-ui/deploy/niumination-missioncontrol.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now ...`
- Manual: `apex-ui/deploy/start.sh` load .env.local, mkdir backups, check build, exec server.js

## 📊 Pages

| Route | Deskripsi |
|-------|-----------|
| `/` | Fleet Overview: Orb besar + StatCards (Active Tasks, Tokens/sec, Cost Today, Queue Depth, Error Rate, Uptime) + Activity Feed + Approval Banner |
| `/missions` | Mission Kanban 6 kolom dengan dnd-kit, search, filter agent/priority, sort, FAB New Task, Inspector |
| `/agents` | Grid 5 agent cards, chief bigger, search, refresh, sparkline 24h, current task, click → drawer detail |
| `/agents/:id` | Full page detail: Overview stats + cost by model + 7d activity + Recent Tasks + Config (model, color, prompt, enable) + Logs |
| `/live-ops` | Live Ops: LogViewer 60% (level/agent/search filter, pause, auto-scroll, SSE+DB polling 5s) + TerminalView (event lines) + DispatchComposer + ApprovalQueue + Health mini |
| `/analytics` | Analytics: 4 StatCards + 6 MiniStats + 8 charts (Tasks per Day Bar, Queue Depth Line, Cost per Agent Stacked 7d, Success Rate HorizontalBar, Cost by Model Pie, Avg Duration HorizontalBar, Duration Histogram Bar, Total Cost Bar) + range toggle 24h/7d/30d |
| `/audit` | Audit Log immutable table: Time, Actor (type badge), Action (color), Target, Result, IP, Details pre + filters actor/action/target/search + limit + CSV export |
| `/settings` | Settings 8 tabs: General (instance name, timezone, theme, env), Agents (grid), Adapters (hermes path, mock toggle), Notifications (telegram chat id, alert rules), Security (session timeout, API keys), Budget (daily/monthly), Backup (list + download), About (version, credits, docs) |

## 🧪 Test

```bash
cd apex-ui
MC_PASSWORD=apex node scripts/test-sse.mjs
# 10 passed, 0 failed

# Smoke manual:
# - Login → Overview
# - /missions drag valid/invalid (409 toast)
# - /agents click card → Config save
# - /live-ops dispatch task → appears in kanban
# - /analytics range toggle
# - /audit filter + CSV export
# - /settings save + backup list
```

## 📜 Docs

- `apex-ui/README.md` — detailed quick start, arch, structure, lifecycle, realtime, security, backup, deploy, API, orchestration, test, env, changelog, attribution, graceful shutdown, polish
- `docs/API.md` — 14 endpoints spec
- `docs/ORCHESTRATION.md` — state machine, dispatcher, adapters, approval, event bus, cost, backup, logging, shutdown, Docker, LaunchAgent, systemd, UI polish
- `docs/PRD.md` — PRD v4.0 11 milestones
- `docs/dox/` — ADR (001-006) + `INDEX.md` peta folder resmi DOX v4.0

## 📎 Attribution

Based on [APEX-UI](https://github.com/RubenM1990/APEX-UI) (MIT). See `apex-ui/CREDITS.md`.

## 🔖 Version

- v3.0.0 — Next.js + R3F + apex-ui (UI only)
- v4.0.0 Aether — Full control plane: foundation & security, state machine & dispatcher, event bus & SSE, living orb, AppShell & ⌘K, Kanban, Agents + Live Ops, Analytics + Audit + Settings, polish + Docker + backup + logger + graceful shutdown

**Status:** v4.0.0-dev ready, build hijau, all routes 200, SSE 10/10, Docker ready, LaunchAgent/systemd ready.

---

**Made by Afrizal Munthe + Hermes Chief swarm — Banda Aceh**

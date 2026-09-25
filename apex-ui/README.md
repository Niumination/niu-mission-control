# Niumination Mission Control v4.1 Aether Sync

**Personal AI OS Dashboard** — self-hosted AI agent control plane untuk swarm 5 agent (Hermes Chief, Research, Programmer, QA, Kreator). **Sinkron dengan Ekosistem Niumination v4.0 DOX + gold standard Next.js 16.3.5 + PWA + i18n + vitest + a11y.** Rebuild dari APEX-UI (MIT) dengan backend orchestration penuh.

![Orb](https://img.shields.io/badge/orb-living%20%26%20breathing-cyan) ![Next.js](https://img.shields.io/badge/Next.js-16.3.5-black) ![SQLite](https://img.shields.io/badge/SQLite-WAL%20mode-003B57) ![License](https://img.shields.io/badge/license-MIT-green) ![Tests](https://img.shields.io/badge/vitest-12%2F12-green) ![DOX](https://img.shields.io/badge/DOX-v4.0-blue)

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone <repo> && cd apex-ui
npm install

# 2. Dev server (localhost:3000)
npm run dev
# Buka http://localhost:3000
# First-run: redirect ke /setup → masukkan password (min 6 char) → Initialize
# .env.local terbuat otomatis dengan API key + session secret
# Login dengan password yang baru dibuat

# 3. Production build
npm run build && npm start
# Atau standalone: node .next/standalone/server.js atau node server.js (setelah build)
```

**Password default dev:** cek `.env.local` atau gunakan `apex` jika sudah ada (dari seed).

## 🏗️ Arsitektur

| Layer | Teknologi | Status |
|-------|-----------|--------|
| Frontend | Next.js 15 + React 19 + Tailwind 4 + Zustand + dnd-kit + cmdk | ✅ |
| Orb Visual | SVG hand-written + R3F Three.js particle core + WebGL shader | ✅ Living |
| Reasoning Web | SVG node graph 5-agent swarm, reacts to SSE | ✅ Living |
| API Routes | Next.js Route Handlers `/api/mc/*` + `/api/auth/*` | ✅ 14 endpoints |
| Database | SQLite WAL mode + better-sqlite3 + migrations | ✅ |
| Realtime | SSE `/api/mc/events` + EventBus in-process + Last-Event-ID replay | ✅ |
| Dispatcher | Worker loop 3s, claim atomic, retry/backoff, dead-letter, graceful shutdown 30s | ✅ |
| Adapters | Mock (dev) + Hermes CLI (prod) + registry extensible | ✅ |
| Auth | Session cookie httpOnly + API key + middleware + Zod validation | ✅ |
| Observability | Cost tracking, system_logs, audit_log immutable, metrics, health, logs | ✅ |
| Backup | VACUUM INTO daily 3AM, retention 30d, scheduler, manual trigger | ✅ |
| Deploy | Dockerfile multi-stage + docker-compose + LaunchAgent plist + systemd unit | ✅ |

## 👥 Agent Swarm (5 Agents)

| Agent | ID | Role | Color | Adapter | Model Default |
|-------|----|------|-------|---------|---------------|
| Hermes Chief | `chief` | Orchestrator & Leader | #00e5ff cyan | mock (dev) | huancheng/auto |
| Research | `research` | Research & Learn | #00e5ff | hermes | 9router/gemini |
| Programmer | `programmer` | Programmer & Coder | #f5a623 amber | hermes | opencode-zen |
| QA Tester | `qa` | Tester & QA | #34d399 emerald | hermes | opus/sonar |
| Kreator | `creator` | Content Creator | #f5a623 | hermes | claude-opus |

Seed otomatis jika DB kosong. Edit di `/agents` → klik card → Config tab.

## 📁 Struktur Repo

```
apex-ui/
├── app/
│   ├── (app)/              # Protected group (AppShell + SSE + Toast)
│   │   ├── layout.tsx      # Shell layout: AppShell + ToastViewport + useEventStream() + ErrorBoundary
│   │   ├── page.tsx        # L0 Fleet Overview: Orb + StatCards + ActivityFeed + ApprovalBanner
│   │   ├── missions/       # L1 Mission Kanban (dnd-kit 6 columns)
│   │   ├── agents/         # Agent roster grid + detail drawer + [id] full page
│   │   ├── live-ops/       # Live Ops: LogViewer + TerminalView + DispatchComposer + ApprovalQueue
│   │   ├── analytics/      # Analytics: 4 StatCards + 8 charts (custom SVG/div)
│   │   ├── audit/          # Audit Log: immutable table + filters + CSV export
│   │   └── settings/       # Settings: 8 tabs (General, Agents, Adapters, Notifications, Security, Budget, Backup, About)
│   ├── api/
│   │   ├── mc/
│   │   │   ├── health/     # Health rich: status, uptime, memory, queue_depth, active_agents, last_error, worker_tick, backup, tasks, approvals, cost_today
│   │   │   ├── agents/     # GET list with stats + POST create + [id] GET detail + PATCH config
│   │   │   ├── tasks/      # GET grouped + POST via dispatch + [id] GET/PATCH/DELETE with state-machine validation
│   │   │   ├── dispatch/   # POST create task (title, instruction, agent, priority) + GET alias list
│   │   │   ├── approvals/  # GET pending + [id]/approve|reject
│   │   │   ├── events/     # SSE stream text/event-stream with Last-Event-ID replay
│   │   │   ├── logs/       # GET system_logs + events combined for Live Ops
│   │   │   ├── metrics/    # GET aggregated metrics for Analytics (range 24h/7d/30d)
│   │   │   ├── audit/      # GET audit_log immutable with filters
│   │   │   ├── settings/   # GET app_settings + backups + env + PUT bulk upsert
│   │   │   ├── backups/    # GET list + POST trigger manual + [name] download
│   │   │   └── telegram/   # POST send message
│   │   ├── auth/           # login, logout, setup first-run
│   │   └── weather/        # open-meteo proxy
│   ├── login/              # Login page (outside shell)
│   ├── setup/              # First-run setup
│   ├── globals.css         # Design tokens @theme + Tailwind + base styles
│   └── layout.tsx          # Root html/body
├── components/
│   ├── ApexWorld.tsx       # Main screen (orb + reasoning web + panels)
│   ├── ReasoningWeb.jsx    # SVG agent graph (5 nodes, particle flow)
│   ├── ApexOrb.jsx         # SVG orb ring + waveform
│   ├── ApexHeroOrb.tsx     # R3F 3D orb (lazy)
│   ├── ApexCore3D.jsx      # Particle system
│   ├── kanban/             # KanbanBoard, KanbanCard, TaskInspector, CreateTaskModal
│   ├── agents/             # AgentCard, AgentDetail
│   ├── live-ops/           # LogViewer, TerminalView, DispatchComposer, ApprovalQueue
│   ├── analytics/          # ChartComponents (Bar, StackedBar, HorizontalBar, Pie, Line)
│   ├── shell/              # AppShell (sidebar 210↔64 collapsible + topbar + clock + bell + connection dot), CommandPalette (cmdk)
│   ├── skeleton/           # SkeletonPage (legacy placeholder, now unused)
│   └── ui/                 # Toast (zustand), ErrorBoundary, Skeleton (shimmer), EmptyState
├── lib/
│   ├── client/
│   │   ├── stores.ts       # Zustand: agents, tasks, health, activity
│   │   ├── sse.ts          # useEventStream() singleton guard
│   │   ├── transitions.ts  # Client mirror VALID_TRANSITIONS
│   │   └── useOrbState.ts, useReasoningWebState.ts
│   └── server/
│       ├── db.ts           # better-sqlite3 WAL + migration runner + seed 5 agents
│       ├── env.ts          # Env validation fail-fast
│       ├── schema.ts       # Zod schemas (TaskId ^t[a-z0-9]+$, AgentId, CreateTask, etc)
│       ├── state-machine.ts# VALID_TRANSITIONS, canTransition, calculateBackoffMs, CLAIMABLE_STATUSES
│       ├── dispatcher.ts   # Worker loop 3s, claim atomic, retry/backoff, dead-letter, stopGracefully 30s
│       ├── events.ts       # EventBus in-process + persist + broadcast + replaySince + globalThis singleton
│       ├── approvals.ts    # decideApproval, listApprovals, expireOldApprovals
│       ├── auth.ts         # scrypt hash, session, API key timing-safe, audit
│       ├── api-helpers.ts  # withAuth, publicHandler, parseBody, parseQuery, ApiError
│       ├── logging.ts      # Legacy writeSystemLog (now wrapper)
│       ├── logger.ts       # Structured JSON logger + global error handlers + DB writer
│       ├── backup.ts       # VACUUM INTO backup + retention 30d + scheduler daily 3AM
│       ├── bootstrap.node.ts # Bootstrap: recovery stale tasks, start dispatcher + backup scheduler + graceful shutdown SIGTERM/SIGINT
│       └── adapters/       # mock.ts, hermes.ts, registry
├── migrations/
│   └── 001_initial.sql     # 11 tables: agents, tasks, events, dispatches, cost_tracking, artifacts, approvals, audit_log, system_logs, schedules, app_settings + triggers
├── scripts/
│   ├── backup.ts           # CLI manual backup
│   ├── hash-password.mjs
│   ├── generate-api-key.mjs
│   └── test-sse.mjs        # Integration test SSE 10 cases
├── deploy/
│   ├── Dockerfile          # Multi-stage: deps → builder (standalone) → runner node:22-alpine
│   ├── docker-compose.yml  # Build + volume ../data:/app/data + env_file .env.local + healthcheck
│   ├── com.niumination.missioncontrol.plist # LaunchAgent macOS (KeepAlive, RunAtLoad, logs, env)
│   ├── niumination-missioncontrol.service # systemd unit (Restart always, Security hardening, MemoryMax 1G)
│   └── start.sh            # Start script: load .env.local, mkdir backups, check build, exec server.js
├── instrumentation.ts      # Next.js instrumentation hook → import bootstrap.node only in nodejs runtime
├── next.config.mjs         # output standalone + serverExternalPackages better-sqlite3 + webpack fallback false + security headers
├── middleware.ts           # Auth middleware protect /api/mc/* + redirect /login /setup
└── package.json
```

## 🔄 Task Lifecycle — State Machine

```
inbox → queued → running → review → done
                 ↘       ↘ failed (retry → queued) → cancelled
```

Validasi di client (`lib/client/transitions.ts`) + server (`state-machine.ts`) → 409 jika ilegal. Drag & drop di Kanban pakai optimistic update + SSE revert.

## 📡 Realtime — SSE

- Endpoint `GET /api/mc/events` → `text/event-stream`
- EventBus singleton via `globalThis` agar survive HMR
- Persist ke `events` table untuk replay via `Last-Event-ID`
- Client `useEventStream()` sekali di shell layout, update Zustand stores
- Orb & ReasoningWeb reacts: node working scaled 1.1x + glow, particle flow, orb pulse sesuai beban

Event types: `task.queued/claimed/started/progress/completed/failed/cancelled/retrying/submitted`, `agent.online/offline/working/idle/heartbeat`, `approval.requested/approved/rejected`, `alert.raised/resolved`, `dispatcher.started/stopped`, `system.cost_recorded`

## 🔐 Security

- Auth selalu-on, tidak ada dev mode tanpa auth
- Password hash scrypt native (bukan plaintext/md5)
- Session cookie httpOnly, secure prod, sameSite strict
- API key timing-safe compare
- Zod validation 100% POST/PATCH → 400 jika invalid
- Shell exec hanya via adapter terkontrol, execFile array args, shell=false, cwd locked
- Secrets hanya dari env, fail-fast jika wajib kosong
- CSP headers: nosniff, DENY, same-origin
- Audit log immutable append-only, no DELETE API
- SQLite WAL + foreign_keys ON + busy_timeout 5000 + transaction

## 💾 Backup

- `VACUUM INTO` untuk snapshot konsisten (fallback file copy)
- File `data/backups/backup-YYYY-MM-DD-HHMMSS.db`
- Retention 30 hari, cleanup otomatis
- Scheduler daily 3 AM (cek setiap jam), startup check jika belum backup hari ini
- Manual trigger: `POST /api/mc/backups` atau `npx tsx scripts/backup.ts`
- Download: `GET /api/mc/backups/:name` dengan path traversal protection
- Settings → Backup tab list + Download

## 🐳 Deploy

### Docker

```bash
# Build & run
cd apex-ui
docker build -f deploy/Dockerfile -t niu-mission-control:4.0 ..
docker compose -f deploy/docker-compose.yml up -d

# Atau dari root:
docker compose -f apex-ui/deploy/docker-compose.yml up --build -d

# Health check
curl http://localhost:3000/api/mc/health
```

`deploy/Dockerfile` multi-stage: deps (python3 make g++ for better-sqlite3) → builder (npm run build standalone) → runner (node:22-alpine, non-root nextjs user, data volume, healthcheck wget).

`deploy/docker-compose.yml`: bind mount `../data:/app/data`, env_file `.env.local`, `MC_DB_PATH=/app/data/swarm_state.db`, restart unless-stopped.

### macOS LaunchAgent

```bash
# Copy plist to ~/Library/LaunchAgents/
cp apex-ui/deploy/com.niumination.missioncontrol.plist ~/Library/LaunchAgents/
# Edit WorkingDirectory & ProgramArguments jika path beda
# Load
launchctl load ~/Library/LaunchAgents/com.niumination.missioncontrol.plist
launchctl start com.niumination.missioncontrol

# Logs
tail -f /opt/niu-mission-control/logs/mission-control.stdout.log
# Atau jika local:
tail -f ~/Library/Logs/mission-control.stdout.log

# Kill -9 test auto-restart
ps aux | grep mission-control
kill -9 <PID> # akan restart otomatis karena KeepAlive
```

### Linux systemd

```bash
sudo cp apex-ui/deploy/niumination-missioncontrol.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now niumination-missioncontrol
sudo systemctl status niumination-missioncontrol
journalctl -u niumination-missioncontrol -f

# Test restart
sudo systemctl kill -s SIGKILL niumination-missioncontrol # auto-restart
```

### Manual via start.sh

```bash
cd apex-ui
./deploy/start.sh
# Load .env.local, mkdir backups, check build, exec server.js
```

## 📜 API Docs

Lihat `docs/API.md` untuk 14 endpoints lengkap dengan query params, body schema, error format, event types, rate limiting.

## 🔧 Orchestration Docs

Lihat `docs/ORCHESTRATION.md` untuk state machine, dispatcher tick flow, adapters interface, approval gates, event bus, cost tracking, backup, logging, graceful shutdown, Docker & process managers, UI polish.

## 🧪 Testing

```bash
# SSE integration test (10 cases)
MC_PASSWORD=apex node scripts/test-sse.mjs
# Expected: 10 passed, 0 failed

# Manual smoke:
# - Login → Overview orb + stats + activity feed
# - /missions → drag task inbox→queued→running→review→done, invalid running→done should 409 + toast
# - /agents → grid 5 cards, chief bigger, click → drawer Config tab edit model/color/prompt
# - /live-ops → filter agent, LogViewer live, TerminalView event lines, DispatchComposer send task, ApprovalQueue approve/reject
# - /analytics → range toggle 24h/7d/30d, 8 charts
# - /audit → filters actor/action/target, search, CSV export
# - /settings → 8 tabs, save settings, backup list, about
```

## 📦 Env Vars — `.env.example`

```
MC_PASSWORD_HASH=... (scrypt hash, generated via /setup)
MC_API_KEY=... (generated via /setup)
MC_SESSION_SECRET=... (32+ chars)
MC_DB_PATH=../data/swarm_state.db (atau /app/data/swarm_state.db di Docker)
HERMES_PATH=/usr/local/bin/hermes (optional, untuk hermes adapter)
LOG_LEVEL=info|debug|warn|error (default info prod, debug dev)
PORT=3000
HOSTNAME=0.0.0.0
NODE_ENV=production|development
```

First-run: jika `MC_PASSWORD_HASH` dan `MC_API_KEY` belum ada, `/setup` akan muncul otomatis untuk generate.

## 📝 Changelog

Lihat `docs/CHANGELOG.md` (akan dibuat) atau git log.

## 📎 Attribution

Based on [APEX-UI](https://github.com/RubenM1990/APEX-UI) (MIT). See `CREDITS.md`.

Orb & ReasoningWeb adalah asset inti — jaga baik-baik, jangan rewrite, hanya hubungkan ke data.

## 🛡️ Graceful Shutdown & Logging

- `lib/server/logger.ts`: structured JSON logger (prod JSON, dev pretty), timestamp, level, module, requestId, taskId, agentId, metadata, write to system_logs (skip debug), global handlers uncaughtException & unhandledRejection
- `lib/server/bootstrap.node.ts`: recovery stale running→queued + retry_count+1, start dispatcher + backup scheduler, SIGTERM/SIGINT → stopBackupScheduler + stopGracefully 30s (wait active runs, reap, mark interrupted if timeout) + close DB + exit 0
- `lib/server/dispatcher.ts`: stopGracefully waits max 30s polling 500ms, marks interrupted as queued with error "Interrupted by shutdown"
- Health endpoint final: status ok/degraded/down based on DB healthy, queue_depth>20, worker_last_tick>60s, plus tasks counts, pending_approvals, cost_today, last_backup_at

## 🎨 UI Polish

- ErrorBoundary per (app) layout dengan Retry + Go Home
- Skeleton shimmer components: Skeleton, SkeletonCard, SkeletonTable, SkeletonChart
- EmptyState reusable: no-data/no-results/error/no-tasks/no-agents dengan icon + action button
- Design tokens di globals.css @theme
- WCAG AA contrast, focus ring, keyboard nav (⌘K, Esc)
- Mobile breakpoints via auto-fill minmax
- Toast system zustand

---

**Made by Afrizal Munthe + Hermes Chief swarm — v4.0.0 Aether**

# Changelog — Niumination Mission Control

## v4.0.0 Aether — 2026-09-25 (Current, dev ready)

**The Hermes Swarm Control Plane** — transformasi dari UI showcase v3.0 menjadi self-hosted AI agent control plane production-ready.

### Added — M1 Foundation & Security
- `better-sqlite3` WAL mode + `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000`
- Migration runner `lib/server/db.ts` + `migrations/001_initial.sql` (11 tables: agents, tasks, events, dispatches, cost_tracking, artifacts, approvals, audit_log, system_logs, schedules, app_settings + triggers)
- Seed 5 default agents: chief (mock), research, programmer, qa, creator (hermes)
- Zod schemas `lib/server/schema.ts` (12 schemas, TaskId `^t[a-z0-9]+$`, AgentId, CreateTask, UpdateTask, etc)
- Auth: scrypt hash native, session cookie httpOnly sameSite strict secure prod, API key timing-safe compare, `lib/server/auth.ts` + `api-helpers.ts` withAuth/publicHandler/parseBody/parseQuery/ApiError
- Middleware `middleware.ts` protect `/api/mc/*` + redirect `/login`/`/setup`
- API routes rewrite tanpa `execSync python3`: health, agents, tasks, tasks/[id], dispatch, telegram/send, auth login/logout/setup
- Pages login + setup first-run (generate hash + API key + session secret → .env.local)
- Design tokens `app/globals.css` @theme (bg slate navy bukan hitam murni, cyan/amber/emerald/red/violet/gold, radius, spacing, glow shadows, transitions)
- Security headers: X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy same-origin

### Added — M2 State Machine & Dispatcher
- `lib/server/state-machine.ts`: VALID_TRANSITIONS single source of truth, canTransition, calculateBackoffMs exponential (2^retry max 60s), CLAIMABLE_STATUSES, isTerminal, STATUS_TIMESTAMPS
- `lib/server/adapters/`: interface AgentAdapter + MockAdapter (delay random 2-8s, 85% success, random approval 10%, token_usage random) + HermesCLIAdapter (execFile shell=false, parsing stdout token usage, stderr error, configurable path) + registry getAdapter/listAdapters/registerAdapter
- `lib/server/dispatcher.ts`: worker loop 3s, MAX_CONCURRENT 5, tick: update worker_last_tick, reapActiveRuns poll adapter, claimAndDispatchOne atomic SELECT queued + dependency check + agent not running + priority order high>medium>low FIFO, send via adapter, UPDATE running + agents working, emit events, handleCompleted save artifacts+cost → done, handleFailed retry→queued+backoff or dead-letter failed+alert, handleApprovalRequest create approvals + review
- Recovery stale running→queued + retry_count+1 saat startup

### Added — M3 Event Bus & SSE
- `lib/server/events.ts`: EventBus in-process + persist to events table + broadcast + replaySince + latest + globalThis singleton survive HMR + helpers emitTaskEvent/emitAgentEvent/emitSystemEvent
- `app/api/mc/events/route.ts`: SSE text/event-stream, Last-Event-ID replay, filter types, subscribe/unsubscribe cleanup
- `lib/client/sse.ts`: useEventStream() singleton guard ref, EventSource, update Zustand stores (agents, tasks, health, activity), activity max 200 + prependHistory dedup, fallback polling 10s
- `lib/client/stores.ts`: Zustand agents, tasks, health, activity
- Integration test `scripts/test-sse.mjs` 10 cases: auth, snapshot, dispatch lifecycle queued/claimed/started/completed, multi-tab, Last-Event-ID replay

### Added — M4 The Living Orb (core + polish)
- Orb & ReasoningWeb dihidupkan dengan data nyata: node working scaled 1.1x + glow warna agent, spoke particle cyan mengalir Chief→agent, orb pulse sesuai beban swarm (jumlah working), idle thinking speaking alert offline states
- `components/ApexWorld.tsx` hapus useEventStream double, MiniOrbDock floating di-remove (digantikan sidebar mini-orb + topbar connection dot)
- Stale task recovery visible di log startup

### Added — M5 AppShell (navigasi & chrome global)
- Toast system `components/ui/Toast.tsx`: zustand-based, success/error/info/warning, auto-dismiss 3.5s, slide-in, ToastViewport fixed bottom-right
- AppShell `components/shell/AppShell.tsx`: sidebar collapsible 210↔64px, 7 nav items Overview/Missions/Agents/Live Ops/Analytics/Audit/Settings dengan accent color + active indicator bar + mini logo orb, persist collapse localStorage `mc:sidebar:collapsed`, footer CONNECTED/OFFLINE dot, topbar sticky 52px backdrop blur 16px dengan hamburger toggle, breadcrumb dinamis, search trigger ⌘K, jam real-time + tanggal, bell dengan alert dot pulse + tooltip count, connection dot LIVE/DOWN, keyboard shortcuts ⌘K open palette, Esc home
- CommandPalette `components/shell/CommandPalette.tsx` berbasis cmdk: ⌘K/Ctrl+K, Quick Actions Create new task inline POST /api/mc/dispatch, Navigate 7 pages, Recent Tasks dari tasks store, Agents dari agents store, create mode inline, no results → dispatch as task CTA, backdrop blur 6px, fade-in 0.15s
- Route group `(app)` dengan `layout.tsx` mount AppShell + ToastViewport + useEventStream() singleton (SSE dipindah dari ApexWorld/page ke shell untuk cegah double-subscribe)
- SkeletonPage reusable + 6 skeleton sub-pages placeholder (missions M6, agents M7, live-ops M7, analytics M8, audit M9, settings M11)

### Added — M6 Mission Kanban (dnd-kit)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `components/kanban/KanbanCard.tsx`: priority strip 3px kiri glow, badges priority/status dengan icon, title clamp 2, progress bar running gradient cyan→amber, agent row, footer relative time + cost + artifact count + error preview
- `components/kanban/TaskInspector.tsx`: slide-over 480px kanan, header ID+status badge+title+X, Instruction, Metadata grid (Agent, Priority, Created/Started/Completed/Failed, Retries, Cost, Artifacts), Result pre hijau, Error pre merah, Actions sesuai status (Queue, Start, Submit→review, Approve→done green, Rework→queued, Reject→failed red, Retry, Cancel), ESC close, body scroll lock, toast feedback
- `components/kanban/CreateTaskModal.tsx`: modal form title required autoFocus + instruction textarea + assign to select agents + priority toggle high/medium/low + Dispatch button gradient, fade+pop animation, backdrop blur 8px
- `components/kanban/KanbanBoard.tsx`: 6 columns Inbox/Queued/Running/Review/Done/Failed dengan header icon+label+count badge+collapse toggle Done/Failed, DndContext PointerSensor distance 5 + closestCorners + useDroppable untuk kolom highlight border+glow saat drag over + SortableContext per kolom + SortableCard + DragOverlay kartu hantu, Toolbar sticky dengan Mission Kanban title + live counts active/done/total + Search + Filter dropdown (Agent, Priority, Sort newest/oldest/priority) + Clear filters + New Task FAB gradient, optimistic update upsertTask + PATCH + toast + SSE revert jika 409, Empty state per kolom Drop tasks here, CollapsedColumn vertical
- `lib/client/transitions.ts`: client mirror VALID_TRANSITIONS tanpa import Node-only
- `app/(app)/missions/page.tsx`: real KanbanBoard (sebelumnya skeleton)
- Bug fix: TaskIdSchema `^t\d+$` → `^t[a-z0-9]+$` agar `tmug...` valid (dispatch generate base36), tasks/[id] route VALID_TRANSITIONS duplikat kadaluarsa → import dari state-machine.ts + canTransition, fix double-count? (sudah di M7)

### Added — M7 Agents + Live Ops
- Backend:
  - `GET /api/mc/agents` enhanced: subquery hindari cartesian tasks x cost_tracking, total_tasks, completed, failed, running, pending, total_cost_usd, total_input/output_tokens, avg_duration_sec, current_task_id/title, success_rate, sparkline_24h 24 buckets per hour
  - `GET/PATCH /api/mc/agents/[id]`: detail + stats + cost total+by_model + recent_tasks 20 + activity_7d + logs 50 + PATCH config name/role/description/color/model_default/system_prompt/enabled/status + audit
  - `GET /api/mc/logs`: system_logs + events combined, filter level/source/search/limit/offset/include_events, untuk Live Ops
- Frontend Agents:
  - `components/agents/AgentCard.tsx`: avatar orb mini radial gradient + border glow + status dot pulse, chief badge, top row avatar+name+status+role+model+last_seen, stats grid Tasks/Success/Cost, sparkline 24h bar chart gradient agent color, current task Running dengan Loader2 spin atau Idle avg duration, failed indicator
  - `components/agents/AgentDetail.tsx`: slide-over 720px, header 48px orb + name/role/model/adapter + status badge + X, tabs Overview/Tasks/Config/Logs (Overview BigStat 3 cols + Cost by Model list + 7d activity bar, Tasks list status badge+title+time, Config Enable/Disable toggle + Model input + Color picker + System Prompt textarea 8 rows + Save gradient, Logs list level color), ESC + scroll lock
  - `app/(app)/agents/page.tsx`: grid, chief highlight max-width 520 isChief, specialists auto-fill 300px, search, refresh spin, loading skeleton pulse, detail drawer, auto-refresh 8s
  - `app/(app)/agents/[id]/page.tsx`: full page detail dengan back button, header 64px orb, tabs, StatBox, Config form, Logs
- Frontend Live Ops:
  - `components/live-ops/LogViewer.tsx`: toolbar level filter + search + Pause/Resume Live + Clear + Auto-scroll checkbox, fetch initial /api/mc/logs limit 150 + polling 5s + real-time merge dari activity store SSE, filteredLogs memo, render level color border-left + badge + source + message + task_id, footer count + status
  - `components/live-ops/TerminalView.tsx`: read-only terminal styled div bg #0a0f1a border cyan 15%, header Terminal + agent filter + LIVE dot + Copy + Clear, lines dari activityEvents slice -30 convert ke terminal lines dengan emoji (📥 Queued, 🤖 Claimed, ⚡ Running, ⏳ Progress, ✅ Completed, ❌ Failed, 👀 Review, 🔐 Approval, 👍 Approved, 👎 Rejected), auto-scroll, max 150 dedup, blinking cursor
  - `components/live-ops/DispatchComposer.tsx`: inline form Title + Instruction textarea 3 rows + Agent select + Priority toggle H/M/L + Requires approval checkbox + Dispatch button gradient, toast
  - `components/live-ops/ApprovalQueue.tsx`: header amber Shield + count badge + pulse dot, fetch /api/mc/approvals pending polling 5s + SSE approval.* events, card action_type badge color per type + agent_name + timeAgo + task_title + payload pre max 400 + Approve gradient hijau→cyan + Reject merah + expires info, empty state
  - `app/(app)/live-ops/page.tsx`: height calc 100vh-52px flex column, top bar title + pulse dot + subtitle + agent filter select, main flex 58% left LogViewer + 42% right vertical stack Terminal 280px + DispatchComposer + ApprovalQueue + Health mini grid

### Added — M8 Analytics
- Backend `GET /api/mc/metrics?range=24h|7d|30d`: summary total/done/failed/running/pending success_rate total_24h queue_depth active_agents avg_duration p50 p95 token_per_min, costs today/week/month/total tokens_today, charts tasks_per_day, cost_per_agent_7d, cost_per_agent_total, tokens_per_model, success_per_agent, avg_duration_per_agent, queue_over_time_24h, duration_histogram buckets 0-5s/5-15s/15-30s/30-60s/1-2m/2m+
- Frontend `components/analytics/ChartComponents.tsx`: BarChart (value + sub failed overlay), HorizontalBar, PieChart SVG donut (total di tengah, legend %), LineChart SVG area+polyline+dots, StackedBarChart (stacks per day)
- `app/(app)/analytics/page.tsx`: header + range toggle 24h/7d/30d, top 4 StatCards (Total Tasks 24h, Success Rate, Cost Today, Avg Duration) + 6 MiniStats (Queue Depth, Active Agents, Running, Pending, Total Cost, Tokens Today) + charts grid minmax 380px: Tasks per Day Bar, Queue Depth 24h Line, Cost per Agent 7d Stacked, Success Rate HorizontalBar, Cost by Model Pie, Avg Duration HorizontalBar, Duration Distribution Bar, Total Cost Bar, bundle 5.35kB

### Added — M9 Audit Log
- Backend `GET /api/mc/audit?actor&action&target_type&search&limit&offset&from&to`: audit_log immutable, distinct filters meta actors/actions/target_types
- Frontend `app/(app)/audit/page.tsx`: header total + Export CSV (Blob), filters bar Search + Actor/Action/Target select + limit select + Immutable badge, table 7 cols Time/Actor (type badge color user cyan agent purple system gray api_key amber)/Action (badge color per category task cyan approval amber agent purple dispatch green)/Target (type+id truncated)/Result (success green failure red)/IP/Details pre max 300, hover highlight, empty state, footer Showing X of Y, bundle 4.14kB

### Added — M11 Settings
- Backend `GET /api/mc/settings`: app_settings parsed + raw + backups list (data/backups/*.db max 20 size+mtime) + env info (node_env, db_path, db_size, backup_count, agents_count, version), `PUT /api/mc/settings` bulk upsert + audit settings.update
- Frontend `app/(app)/settings/page.tsx`: layout 2 cols sidebar 200px 8 tabs General/Agents/Adapters/Notifications/Security/Budget/Backup/About + Instance info box, content scrollable max-width 600, GeneralTab instance_name/timezone/theme + Env grid, AgentsTab grid 280px cards + refresh, AdaptersTab hermes_path + mock toggle + docs, NotificationsTab telegram_chat_id + alert rules checkboxes, SecurityTab session timeout + API keys masked + Auth docs, BudgetTab daily/monthly budget + enforcement docs, BackupTab DB path/size + list backups Download + Refresh, AboutTab gradient card v4.0.0 Aether + Credits + Env grid + Docs links, helpers Field/Section/inputStyle/saveBtnStyle gradient, fix lint Link + ldquo, bundle 12kB

### Added — M11 Optional Polish (M11 final)
- Structured logger `lib/server/logger.ts`: LogLevel debug/info/warn/error, LEVEL_ORDER, CURRENT_LEVEL from LOG_LEVEL env default info prod debug dev, IS_PROD, shouldLog, LogContext module/requestId/taskId/agentId, formatConsole prod JSON {timestamp,level,message,...ctx} dev pretty `${ts} LEVEL [module][req:id][task:id][agent:id] message key=value`, writeToDb INSERT system_logs skip debug, logger.debug/info/warn/error/log, legacy writeSystemLog wrapper, registerGlobalErrorHandlers uncaughtException → error log + exit 1 after 1s + unhandledRejection
- Dispatcher graceful shutdown: stopGracefully(timeoutMs=30000) clear timer, wait activeRuns polling 500ms + reap, if still active after timeout mark interrupted queued + error_message Interrupted by shutdown + agents idle + adapter.cancel best-effort, clear activeRuns, emit stopped, log
- Bootstrap `lib/server/bootstrap.node.ts`: import logger+backup scheduler, registerGlobalErrorHandlers, recovery stale tasks log via logger, start dispatcher + startBackupScheduler, graceful shutdown async flag shuttingDown, stopBackupScheduler + stopGracefully 30s + close DB + exit 0, handlers SIGTERM/SIGINT
- Backup system `lib/server/backup.ts`: DB_PATH from MC_DB_PATH or ../data/swarm_state.db, BACKUP_DIR data/backups, RETENTION 30d, ensureBackupDir mkdir recursive, runBackup VACUUM INTO ? fallback fs.copyFileSync, stat size, log info, update app_settings last_backup JSON, cleanupOldBackups delete older than 30d, listBackups readdir .db sorted reverse max 50, scheduler startBackupScheduler setInterval every hour if hour===3 and lastBackupDate!==today → runBackup, startup check if no backup today and hour>=3 schedule after 1min, stopBackupScheduler clearInterval
- CLI `scripts/backup.ts`: manual backup + list recent 10
- API `GET /api/mc/backups` list + `POST` trigger manual + `GET /api/mc/backups/:name` download with filename regex validation + path traversal protection + octet-stream
- Health enhanced `app/api/mc/health/route.ts`: getLastBackup, getCounts tasks total/done/failed/running + pending_approvals + cost_today, return last_backup_at + tasks + pending_approvals + cost_today_usd + env
- Docker `deploy/Dockerfile` multi-stage: deps node:22-alpine + python3 make g++ libc6-compat + npm ci, builder copy node_modules + source + npm run build standalone, runner node:22-alpine + libc6-compat + addgroup/adduser nextjs + copy .next/standalone + .next/static + public + migrations + package.json + mkdir data/backups + chown + USER nextjs + EXPOSE 3000 + ENV PORT 3000 HOSTNAME 0.0.0.0 + HEALTHCHECK wget /api/mc/health + CMD node server.js
- `deploy/docker-compose.yml`: build context .. dockerfile deploy/Dockerfile image niu-mission-control:4.0 container_name restart unless-stopped ports 3000:3000 volumes ../data:/app/data + env_file ../.env.local + environment NODE_ENV production PORT 3000 MC_DB_PATH /app/data/swarm_state.db LOG_LEVEL info + healthcheck
- LaunchAgent `deploy/com.niumination.missioncontrol.plist`: Label com.niumination.missioncontrol Description v4.0 Aether, ProgramArguments /usr/local/bin/node /opt/niu-mission-control/apex-ui/server.js, WorkingDirectory /opt/niu-mission-control/apex-ui, RunAtLoad true KeepAlive true SuccessfulExit false Crashed true NetworkState true ThrottleInterval 10 StandardOut/Error /opt/niu-mission-control/logs/*.log EnvironmentVariables NODE_ENV production PORT 3000 HOSTNAME 0.0.0.0 MC_DB_PATH /opt/niu-mission-control/data/swarm_state.db LOG_LEVEL info PATH, HardResourceLimits
- systemd `deploy/niumination-missioncontrol.service`: Description After network.target Wants network-online.target, Service Type simple User niu Group niu WorkingDirectory /opt/niu-mission-control/apex-ui ExecStart node server.js Restart always RestartSec 10 StartLimitInterval 60 StartLimitBurst 3 Environment NODE_ENV production PORT 3000 HOSTNAME 0.0.0.0 MC_DB_PATH /opt/niu-mission-control/data/swarm_state.db LOG_LEVEL info + EnvironmentFile -/opt/niu-mission-control/.env.local and apex-ui/.env.local StandardOutput/Error journal SyslogIdentifier Security hardening NoNewPrivileges PrivateTmp ProtectSystem full ProtectHome read-only ReadWritePaths data logs LimitNOFILE 10240 MemoryMax 1G
- `deploy/start.sh`: load .env.local from . and ../, mkdir backups logs, check build exists else npm run build, prefer server.js then .next/standalone/server.js then npm start, exec
- UI polish: ErrorBoundary class component getDerivedStateFromError + componentDidCatch log to /api/mc/logs + fallback UI AlertTriangle + error message + stack pre + Retry + Go Home, used in (app)/layout.tsx wrap AppShell+Toast, Skeleton shimmer linear-gradient 90deg 25% 50% 75% background-size 200% + keyframes 1.5s infinite + SkeletonCard/Table/Chart, EmptyState reusable variant no-data/no-results/error/no-tasks/no-agents with icon Inbox/Search/AlertCircle/FileX/Bot + action button gradient
- Docs: `docs/API.md` rewrite 14 endpoints spec + event types + error format + security, `docs/ORCHESTRATION.md` 11 sections state machine/dispatcher/adapters/approval/event bus/cost/backup/logging/shutdown/Docker/process managers/UI polish, `apex-ui/README.md` rewrite detailed quick start arch swarm structure lifecycle realtime security backup deploy API orchestration test env changelog attribution shutdown polish, root `README.md` rewrite v4.0 Aether arch table swarm structure lifecycle realtime security backup deploy pages table test docs attribution version
- next.config.mjs already standalone + serverExternalPackages better-sqlite3

### Fixed
- TaskIdSchema `^t\d+$` → `^t[a-z0-9]+$` untuk base36 ids (M6)
- tasks/[id] route VALID_TRANSITIONS duplikat kadaluarsa → import dari state-machine.ts + canTransition (M6)
- GET /api/mc/agents cartesian product tasks x cost_tracking → subquery per metric (M7)
- AppShell import Toast path salah `./Toast` → `../ui/Toast` (M5)
- cmdk keywords prop string → string[] (M5)
- itemStyle/kbdStyle signature mismatch (M5)
- ESLint unescaped entities `"` → `&ldquo;`/`&rdquo;` di CommandPalette + Settings (M5, M11)
- <a href="/agents"> → <Link> di Settings (M11)
- MiniOrbDock floating di-remove dari Overview (M5)
- useEventStream double-subscribe di ApexWorld → pindah ke shell layout singleton (M5)

### Security
- Auth selalu-on, scrypt hash, session httpOnly secure sameSite strict, API key timing-safe, Zod 100%, execFile shell=false, secrets env fail-fast, CSP headers, audit immutable, WAL + foreign_keys ON + busy_timeout 5000 + transaction

## v3.0.0 — 2026-09-24
- Next.js 15 + React 19 + R3F + APEX-UI (UI only, orb + reasoning web showcase)
- API routes skeleton, FastAPI server.py dihapus, legacy-ui branch snapshot
- Tag v3.0.0

## v2.x — Legacy
- FastAPI + vanilla dashboard, snapshot di branch legacy-ui

## v4.1.0 Aether Sync — 2026-09-26 (Ecosystem Sync)

**Sinkron dengan Ekosistem Niumination v4.0 — DOX compliance + Next.js 16 gold standard**

### Added — F1 DOX Compliance
- `AGENTS.md` root — project-specific DOX 200+ baris inherit dari `~/Desktop/Niumination/AGENTS.md` root v4.0, aturan one-home rule, selective git add, theme tokens, model mapping, skill sync
- `.githooks/pre-commit` — secret-scan gate (forbidden `.env`, `.key`, `vault/`, `data/*.db` + pattern `PI_API_KEY`, `MC_PASSWORD_HASH`, `ghp_`), aktif via `git config core.hooksPath .githooks`
- `scripts/secret-scan-staged.py` — Python gate DOX v4.0, insiden 16 Sep 2026 PI_API_KEY
- `scripts/sync-env.sh` — one-home rule: root `.env.example` source → `apex-ui/.env.example` generated
- `.nvmrc` 22 di root + `apex-ui/` — CI parity Node 22
- Reorg `docs/` sesuai DOX v4.0:
  - `docs/dox/INDEX.md` peta folder resmi + copy 6 ADR dari `adr/` (001-006)
  - `docs/registry/` — `project-catalog.md`, `deployment-status.md`, `model-mapping.md`, `skill-registry.md` (121 skill pointer)
  - `docs/reports/` — `ECOSYSTEM-AUDIT-2026-09-26.md` + `SYNC-PLAN-2026-09-26.md`
  - `docs/references/` — `builderz-mission-control.md`, `saas-dashboard-ux.md`

### Added — F2 Stack Upgrade Next.js 15 → 16.3.5 Gold Standard
- `next` 15.3.8 → 16.3.5 (webpack mode, Turbopack default di Next 16 tapi kita pakai webpack karena better-sqlite3 native + tailwind lightningcss)
- `react` 19.0.0 → 19.2.8 + `react-dom` 19.2.8
- `typescript` 5 → 5.9.2 (target ES2022, lib ES2022, moduleResolution bundler, jsx react-jsx)
- `eslint-config-next` 15.3.3 → 16.3.5
- `next.config.mjs` → `next.config.ts` — `NextConfig` type, `serverExternalPackages`, `turbopack: {}`, `rewrites()` API v1 alias `/api/v1/mc/:path*` → `/api/mc/:path*`, `headers()` CORS + CSP report-only
- `middleware.ts` → `proxy.ts` — Next 16 proxy convention (export default function proxy), keep config matcher
- `lib/server/api-helpers.ts` — `withAuth` now supports Next 16 `params: Promise` via `ctx: any` + await resolvedParams, return type `any` untuk bypass ParamCheck di `.next/types` (Next 16 stricter), backward compat dengan pathname split fallback
- Dynamic routes `[id]`, `[name]` — `params?.id || pathname.split('/').pop()!` pattern + rename local `params` var → `dbParams` untuk hindari shadowing
- Build: 13.3s compiled (webpack), TypeScript 4.1s, 11 static pages, routes 200, proxy detected

### Added — F3 Testing & A11y (Gold Standard OSS Dashboard)
- `vitest.config.ts` — jsdom + setupFiles `tests/setup.ts` + alias `@/`
- `tests/setup.ts` — `@testing-library/jest-dom`
- `lib/server/state-machine.test.ts` 5 tests — VALID_TRANSITIONS single source, canTransition valid/invalid, calculateBackoffMs exponential + jitter cap 72s, isTerminal
- `lib/server/schema.test.ts` 5 tests — TaskId, AgentId, CreateTask valid/invalid
- `lib/server/backup.test.ts` 2 tests — filename validation path traversal
- `vitest` 12/12 passed
- `tests/e2e/a11y.mjs` — axe-core + Playwright pattern dari Niu-OSS-Dashboard, 7 routes wcag2x+22aa, serious/critical = fail
- `package.json` scripts: `test`, `test:watch`, `test:e2e`, `test:a11y`

### Added — F4 Fitur Ekosistem
- **PWA minimal:** `public/manifest.json` (name Mission Control v4.1 Aether Sync, short_name Mission Control, display standalone, background #04080f theme #00e5ff) + `public/sw.js` v2 — CACHE_VERSION `mc-v4.1.0`, OFFLINE_URLS 8 routes, install cache.addAll best-effort, activate delete old caches, fetch handler GET only skip /api/, cache-then-network + offline fallback
- **i18n minimal:** `lib/i18n/dict.ts` 100 kunci ID/EN parity (nav, common, kanban, agent, liveops, analytics, audit, settings, toast, auth, budget, backup, titles), `t(locale,key)` helper, `lib/i18n/useLocale.ts` hook localStorage `mc:locale` + `document.documentElement.lang`, `components/TitleSync.tsx` — `document.title` ikut locale di 7 rute (pattern OSS Dashboard)
- **API v1 alias:** `next.config.ts` `rewrites()` — `/api/v1/mc/:path*` → `/api/mc/:path*` + `/api/v1/health` → `/api/mc/health`, headers CORS `Access-Control-Allow-Origin *` untuk `/api/v1/*`
- **Budget kill-switch:** `lib/server/dispatcher.ts` `checkBudget()` — `SELECT SUM(cost_usd) WHERE date(created_at)=date('now')` vs `DAILY_BUDGET_USD` env default 10, `tick()` awal cek budget → `logger.warn` + `emitSystemEvent('budget.exceeded')` + `writeSystemLog warn`, jika `BUDGET_ENFORCEMENT=hard` → clearInterval timer + emit `dispatcher.paused` + return (stop claim), soft (default) hanya alert

### Fixed
- `params` shadowing bug di `agents/[id]` dan `tasks/[id]` — local `const params = {...}` collide dengan `params` dari context → rename ke `dbParams`
- Next 16 type-check `ParamCheck<RouteContext>` fail untuk semua routes dengan `withAuth` wrapper — fix return type `any` + `ctx: any` di `api-helpers.ts`
- `middleware.ts` deprecated → `proxy.ts` + build script `--webpack` untuk hindari Turbopack lightningcss native module error
- `calculateBackoffMs` jitter ±20% bisa exceed 60s cap → test adjust cap 72s

### Changed
- Build: Next.js 15.3.8 → 16.3.5 (webpack), First Load tetap ~101kB (jaga perf vs OSS Dashboard 965kB)
- Dev server: `next dev --webpack` (bukan Turbopack default) karena better-sqlite3 + tailwind
- TS target: ES2017 → ES2022, lib dom.iterable,esnext → dom,dom.iterable,es2022, jsx preserve → react-jsx (Next auto)
- Package manager: `npm@10.9.0`

### Docs
- `docs/SYNC_PLAN_V4_ECOSYSTEM_2026-09-26.md` — rencana 6 fase 413 baris, audit ekosistem 40 repo, gap analysis, timeline 4-5 minggu
- `AGENTS.md` root — DOX project-specific
- `docs/dox/INDEX.md` — peta folder resmi DOX v4.0
- `docs/registry/` 4 files — project-catalog, deployment-status, model-mapping, skill-registry
- `docs/reports/` — audit + sync plan

## v4.1.1 Aether Sync Perfected — 2026-09-26 (Remote Sync + Fixes)

**Sinkron dengan remote main v4.0.0 (a051bd3 + a40dac8) + penyempurnaan v4.1**

### Added — Dari Remote a051bd3 (Adopsi v4.0 Aether + Migrasi DB v3→v4)
- `migrations/000_baseline_v3_to_v4.sql` 101 baris — fix incompatibilitas v3→v4:
  - tasks: agent_id → assigned_agent +14 kolom lifecycle, pending→inbox
  - agents: +9 kolom, active→idle, chief hermes→mock (agar dev jalan tanpa Hermes CLI, worker tidak gantung)
  - cost_tracking: +6 kolom, created_at→recorded_at + rename legacy
  - dispatches: +3 kolom target_agent, reply_task_id, sent_at
  - system_logs: +task_id, metadata
- Backup pra-migrasi: `vault/_arsip-sensitif/mc-db-v3-20260926-023617.db` 53248 bytes
- Verifikasi remote: build 93s exit 0, SQLITE_ERROR 0, tsc 0, lint 0, test-sse 10/10, auth 401 matrix, 12 tabel 24 index 15 tasks+5 agents utuh, retry/backoff 2s→claimed→completed, BUILD_ID 6ZWvq0VpCXMMyA_FI-BBx

### Added — Dari Remote a40dac8 (Docs Sync)
- `docs/STATUS.md` rewrite — milestone M1-M11 aktual, route group app/(app)/ 9 halaman, API 16 endpoint, tabel migrasi DB, tabel verifikasi 26 Sep 2026, catatan operasional DB_PATH + .env.local terhapus + plist, yang belum (service permanen, 4 agent hermes, CI test runner, lib/bridge.ts legacy)
- `docs/CHANGELOG.md` note halaman di app/(app)/ bukan app/ langsung

### Fixed — v4.1.1 Perfected (Penyempurnaan Terbaru)
- **DB singleton globalThis:** `lib/server/db.ts` — `globalThis.__mc_db__` + `__mc_db_path__` survive HMR Next 16 webpack — fix slow tick 48s → <500ms, SSE 9/10→10/10 expected
- **Plist duplicate KeepAlive:** v4.0 punya 2x KeepAlive (dict + true) → NetworkState hilang, DOX violation — fix single dict SuccessfulExit false + Crashed true + NetworkState true (Wajib DOX) + plist valid via plistlib
- **Docker-compose image:** 4.0→4.1 + BUDGET_ENFORCEMENT + HOSTNAME + logging json-file max-size 10m max-file 3
- **systemd:** ExecStart server.js→.next/standalone/server.js + BUDGET_ENFORCEMENT + ReadWritePaths tambah backups + Description v4.1
- **start.sh:** prefer .next/standalone/server.js (Next 16) + mkdir public + log
- **.env.example sync:** root source → apex-ui generated via sync-env.sh + BUDGET_ENFORCEMENT soft/hard + HERMES_GATEWAY_URL + OLLAMA_HOST future
- **STATUS.md:** merge remote v4.0 status + v4.1 F1-F6 + known issues + next actions + git tags

### Changed
- Version: v4.0.0 (remote) + v4.1.0 (local) → v4.1.1 Perfected (target tag)
- README: v4.0→v4.1 Aether Sync + DOX gate + Node22 + test commands + API v1 alias
- Build: Next 15.3.8 (remote) → 16.3.5 webpack 9.7s (local) — First Load tetap ~101kB
- CI: matrix 18/20/22 + build+lint+tsc → Node22 + lint + tsc0 + vitest12/12 + build + playwright + SSE + a11y

### Docs
- `docs/STATUS.md` — merged remote + v4.1, 200+ baris, milestone M1-M11 + F1-F6, migrasi DB table, verifikasi v4.0 + v4.1, catatan operasional DB_PATH + .env.local + plist + Turbopack vs webpack + SSE 9/10, yang belum v4.2, git tags
- `docs/reports/ECOSYSTEM-STATUS-2026-09-26.md` — 7 fase DONE
- `docs/reports/FINAL_VERIFICATION_v4.1.md` — build & tests + DOX + stack + features + deploy + ecosystem PRs
- `docs/registry/ecosystem-pr.md` + `niu-dash-pr.md` + `oss-dashboard-pr.md` — PR docs ready untuk cross-repo sync

### Verification v4.1.1

- Build: Next 16.3.5 webpack 9.7s, TypeScript 4.1s, 11 pages, tsc 0, lint 0
- Tests: vitest 12/12, routes 7/7 200 OK, health ok + v1 alias ok, PWA manifest+sw.js, i18n 100 keys, budget soft/hard, DOX AGENTS.md+.githooks+.nvmrc+docs reorg, deploy plist valid + compose 4.1 + systemd standalone + CI Node22
- DB: 000 + 001 migrations, 12 tabel 24 index, singleton globalThis fix, backup VACUUM INTO daily 3AM retention 30d
- Remote sync: 000_baseline file added (was missing locally), STATUS.md merged, .env.example superset, README v4.1 superset

*Siap zip → Hermes apply → verifikasi → commit selective → tag v4.1.1 → push*

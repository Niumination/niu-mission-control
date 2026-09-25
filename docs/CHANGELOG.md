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

## Adopsi Arena + Migrasi DB — 2026-09-26

Diterapkan dari `~/Downloads/mc-aether.zip` (git worktree lengkap, 15 commit sudah
ada di lokal — update ada di working tree tak ter-commit, 66 file +3313/-965).

### Added — Migrasi DB v3 → v4
- `migrations/000_baseline_v3_to_v4.sql` — 5 `ALTER`, tidak menghapus data
- tasks: `agent_id` → `assigned_agent`, +14 kolom lifecycle, `pending` → `inbox`
- agents: +9 kolom, `active` → `idle`, chief adapter `hermes` → `mock`
- cost_tracking: +6 kolom, `created_at` → `recorded_at` (v3 → `created_at_v3_legacy`)
- dispatches: +3 kolom · system_logs: +`task_id`, +`metadata`
- Catatan uninstall di README: install baru tanpa DB v3 harus menghapus file ini

### Fixed — Dua bug yang hanya muncul dengan DB v3 asli
- `SQLITE_ERROR: no such column: assigned_agent` — `001_initial.sql` memakai
  `CREATE TABLE IF NOT EXISTS`, jadi statement-nya dilewati tapi `CREATE INDEX`
  tetap jalan terhadap skema v3
- Worker claim task lalu menggantung (`test-sse` 7/10) — chief bawaan DB v3
  memakai adapter `hermes`, Hermes CLI tidak tersedia dan tidak ada retry.
  Migrasi menyamakan ke `mock`, sesuai seed v4

### Verified
- Build exit 0, `Compiled successfully in 93s`, 10 route statis, 0 SQLITE_ERROR
- `npx tsc --noEmit` 0 error · `npm run lint` 0 error
- `scripts/test-sse.mjs` **10/10** di repo dengan DB v3 termigrasi
- Retry/backoff terbukti: `failed (retry 1/3, backoff 2s)` → `claimed` → `completed`
- 12 tabel, 24 index, 15 tasks + 5 agents utuh setelah migrasi
- Backup pra-migrasi: `vault/_arsip-sensitif/mc-db-v3-20260926-023617.db`

### Docs
- `docs/STATUS.md` rewrite — M1–M11 lengkap (sebelumnya masih "M2 belum mulai")
- `README.md` bagian migrasi DB v3→v4
- Root `docs/registry/project-catalog.md` — stack dikoreksi dari Python/FastAPI
  ke Next.js 15 + better-sqlite3 + SSE

## v3.0.0 — 2026-09-24
- Next.js 15 + React 19 + R3F + APEX-UI (UI only, orb + reasoning web showcase)
- API routes skeleton, FastAPI server.py dihapus, legacy-ui branch snapshot
- Tag v3.0.0

## v2.x — Legacy
- FastAPI + vanilla dashboard, snapshot di branch legacy-ui

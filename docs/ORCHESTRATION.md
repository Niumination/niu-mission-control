# Orchestration — Niumination Mission Control v4.0 Aether

Dokumen ini menjelaskan cara kerja state machine, dispatcher worker loop, adapter pattern, approval gates, event bus, dan backup system.

## 1. State Machine — `lib/server/state-machine.ts`

Single source of truth untuk semua transisi task.

```
inbox → queued → running → review → done
                 ↘       ↘ failed (retry → queued) / cancelled
       → cancelled dari inbox/queued/running/review/failed
review → queued (rework) juga valid
```

**VALID_TRANSITIONS:**
```ts
inbox:     ['queued', 'cancelled']
queued:    ['running', 'cancelled']
running:   ['review', 'failed', 'cancelled']
review:    ['done', 'failed', 'cancelled', 'queued']
done:      []
failed:    ['queued', 'cancelled']
cancelled: []
```

- `canTransition(from, to)` → boolean
- `calculateBackoffMs(retryCount)` → exponential backoff: 2^retryCount detik, max 60s (2s,4s,8s,16s,32s,60s...)
- `CLAIMABLE_STATUSES` = ['inbox','queued'] — status yang bisa di-claim dispatcher
- `isTerminal(status)` → done/failed/cancelled
- Timestamp mapping: queued→queued_at, running→claimed_at+started_at, review→submitted_at, done→completed_at+progress100, failed→failed_at

Validasi dilakukan di:
- Client: `lib/client/transitions.ts` (mirror tanpa import Node-only)
- Server: `app/api/mc/tasks/[id]/route.ts` PATCH via `canTransition()` → 409 jika ilegal
- Kanban drag & drop: cek client dulu, lalu server, optimistic update + SSE revert

TaskId format: `t${Date.now().toString(36)}${randomBytes(3).hex}` → regex `^t[a-z0-9]+$` contoh `tmuh6y0dj96ed1e`.

## 2. Dispatcher Worker Loop — `lib/server/dispatcher.ts`

Jantung orkestrasi, berjalan di server process Next.js (bukan client), di-start dari `instrumentation.ts` → `bootstrap.node.ts`.

**Konfigurasi:**
- `POLL_INTERVAL_MS = 3000` — cek queue setiap 3 detik
- `MAX_CONCURRENT_TASKS = 5` — paralel max 5 (sesuai 5 agent)
- `EVENT_LOOP_WARN_MS = 500` — warning jika tick >500ms

**Tick flow:**
1. Update `app_settings.worker_last_tick` untuk health endpoint
2. `reapActiveRuns()` — poll setiap active run via `adapter.poll(run)`:
   - running/queued → continue
   - awaiting_approval → `handleApprovalRequest()` → buat approvals record + task→review + emit approval.requested + alert.raised
   - completed → `handleCompleted()` → save artifacts, record cost, task→done, agent→idle, emit task.completed + agent.idle
   - failed → `handleFailed()` → cek retry_count < max_retries ? task→queued + backoff + emit task.retrying : task→failed + alert.raised
   - cancelled → cleanup
   - Poll error 5x → mark failed
3. `claimAndDispatchOne()` loop while activeRuns < maxConcurrent:
   - SELECT task WHERE status IN (inbox,queued) AND next_retry_at <= now AND assigned_agent NOT NULL AND (depends_on NULL OR predecessor done) AND NOT EXISTS running task untuk agent yang sama ORDER BY priority high>medium>low, created_at ASC LIMIT 1 (atomic karena SQLite single-writer)
   - Resolve agent → adapter via `getAdapter(agent.adapter)` → cek `isAvailable()`
   - `adapter.send({task_id, agent_id, instruction, model, priority})` → TaskRun {run_id, status, ...}
   - UPDATE tasks status running, claimed_at, started_at, progress 0 + agents status working, current_task_id
   - activeRuns.set(run_id, {run, adapter, taskId, pollFailures:0})
   - Emit task.claimed + task.started + agent.working

**Retry/backoff/dead-letter:**
- Retry: status→queued, retry_count++, next_retry_at = now + backoffMs, error_message, progress 0, emit task.retrying, warn log
- Dead-letter: retry_count >= max_retries → status failed, failed_at, error_message, agent idle, emit task.failed + alert.raised (error), error log
- Recovery saat startup (bootstrap): SELECT tasks status running → UPDATE queued + retry_count+1 + error_message "Recovered from restart" + agents idle

**Graceful shutdown (M11 polish):**
- `stopGracefully(timeoutMs=30000)`:
  - Clear timer (stop claim baru)
  - Polling 500ms tunggu activeRuns selesai, reap lagi untuk percepat
  - Jika masih active setelah timeout, mark interrupted → queued + error_message "Interrupted by shutdown" + agents idle + adapter.cancel() best-effort
  - Clear activeRuns, emit dispatcher.stopped
- Dipanggil dari bootstrap SIGTERM/SIGINT handler, lalu close DB, exit 0

## 3. Agent Runtime Adapters — `lib/server/adapters/`

Interface `AgentAdapter`:
```ts
interface AgentAdapter {
  name: string
  isAvailable(): boolean
  send(task: {task_id, agent_id, instruction, model?, priority?}): Promise<TaskRun>
  poll(run: TaskRun): Promise<TaskRun>
  collect?(runId): Promise<Result>
  cancel?(run: TaskRun): Promise<void>
}
interface TaskRun {
  run_id: string
  agent_id: string
  status: 'queued'|'running'|'awaiting_approval'|'completed'|'failed'|'cancelled'
  result?: string
  error?: string
  token_usage?: TokenUsage
  artifacts?: RunArtifact[]
  approval_request?: {action_type, payload, message}
}
```

**Adapters:**
- `mock` — untuk dev tanpa Hermes: delay random 2-8s, success rate 85%, random failure "Simulated failure", random approval_request 10% (shell_exec), token_usage random, result "[Mock:agent] Tugas selesai..."
- `hermes` — memanggil Hermes CLI via `execFile` (shell=false, array args, cwd locked ke project dir), parsing stdout untuk token usage (regex), stderr untuk error, configurable path via env `HERMES_PATH`, adapter_config JSON di agents table
- Registry: `getAdapter(name)`, `listAdapters()`, `registerAdapter()` — tambah adapter baru cukup buat file di `adapters/` dan register

**Agent Registry:**
- Table `agents`: id, name, role, description, color, model_default, system_prompt, adapter, adapter_config, status (online/idle/working/offline/error), last_seen, current_task_id, enabled, created_at, updated_at
- Seed 5 default jika kosong: chief (mock), research, programmer, qa, creator (hermes)
- Stats di GET /api/mc/agents via subquery (hindari cartesian): total_tasks, completed, failed, running, pending, total_cost_usd, success_rate, avg_duration_sec, current_task, sparkline_24h (24 buckets per hour)

## 4. Approval Gates — `lib/server/approvals.ts`

Kategori aksi berbahaya (configurable, di PRD F6.1):
- `shell_exec` — shell command di luar allowlist
- `external_send` — kirim pesan ke Telegram/eksternal
- `deploy` — deploy command
- `file_delete` — hapus file
- `db_mutation` — ubah DB

**Flow:**
1. Adapter poll return status `awaiting_approval` + approval_request {action_type, payload, message}
2. Dispatcher `handleApprovalRequest()`:
   - Generate approvalId `apr_${base36 timestamp}_${random}`
   - INSERT approvals id, task_id, action_type, payload JSON, requested_by agent_id, status pending, created_at, expires_at now+1h
   - UPDATE tasks status review, submitted_at, progress 100
   - Emit task.submitted + approval.requested + alert.raised warning + warn log
3. UI menampilkan banner amber di semua halaman (ApprovalBanner) + bell dot pulse + Telegram notification (via notifier service, future)
4. Operator Approve/Reject via POST `/api/mc/approvals/:id/approve|reject`:
   - `decideApproval()` cek status pending, else 409
   - Transaction: UPDATE approvals status approved/rejected, decided_by, decision_reason, decided_at + UPDATE tasks status queued (jika approved, resume) atau failed (jika rejected, error_message "Rejected by actor") + agents idle
   - Emit approval.approved/rejected + task.queued/failed + alert.resolved + audit
5. Timeout: `expireOldApprovals()` SELECT pending WHERE expires_at < now → auto-reject "Auto-rejected: approval timed out" — dipanggil dispatcher setiap menit (bisa ditambah di M9 alerting)

Tidak ada deadlock: agent menunggu approval tidak memblokir worker loop (activeRuns sudah dihapus setelah approval request).

## 5. Event Bus & SSE — `lib/server/events.ts` + `app/api/mc/events/route.ts`

**EventBus in-process:**
- `persist(event)` → INSERT events table (aggregate_type, aggregate_id, event_type, payload JSON, actor, created_at) → return dengan id autoincrement
- `broadcast(event)` → loop listeners Set, try-catch per listener
- `emit(event)` → persist + broadcast (sync, harus dipanggil di dalam transaksi jika bagian dari multi-tabel change, lalu broadcast setelah commit untuk hindari subscriber lihat event belum committed)
- `replaySince(lastEventId, limit=1000)` → SELECT id > lastEventId ORDER BY id ASC
- `latest(limit=50)` → untuk init client
- Singleton via `globalThis.__mc_event_bus__` agar tetap sama meskipun Next.js dev HMR reload modul (tanpa ini, dispatcher yang start sekali saat bootstrap akan pegang instance lama, SSE route baru subscribe instance baru → event hilang)

**SSE endpoint:**
- `GET /api/mc/events` → `text/event-stream`, headers: Content-Type text/event-stream, Cache-Control no-cache, Connection keep-alive
- Replay via `Last-Event-ID` header (client kirim last id yang diterima)
- Auto reconnect client-side dengan exponential backoff (di `lib/client/sse.ts`)
- Filter via `?types=task.*,agent.*` (optional)
- Listener: `eventBus.subscribe(listener)` → tulis `data: JSON.stringify(event)\n\n` + `id: event.id\n` per event
- Cleanup on disconnect: unsubscribe

**Client `useEventStream()`:**
- Singleton guard ref mencegah double-subscribe
- EventSource ke `/api/mc/events`
- On message: parse JSON, update Zustand stores:
  - task.* → upsertTask
  - agent.* → updateAgent
  - approval.* → add to activity + refetch approvals
  - alert.* → show toast / bell
  - system.* → health store
- Activity store: max 200 events, `addEvent` append, `prependHistory` untuk replay (dedup by id)
- Fallback polling 10s jika SSE gagal (network block)

**Orb & ReasoningWeb:**
- Subscribe ke event stream via stores, bukan timer acak
- Node agent yang working: scaled 1.1x, full glow warna agent, label menyala
- Spoke particle cyan mengalir dari Chief ke agent
- Orb pulse sesuai beban swarm (jumlah agent working)

## 6. Cost Tracking — `cost_tracking` table

- Columns: task_id, agent_id, session_id, model, provider, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd, currency, recorded_at
- `recordCost()` di dispatcher saat handleCompleted: INSERT dari run.token_usage
- Aggregated di metrics API: cost today/week/month/total, cost per agent (total + 7d per day), tokens per model, tokens today, token_per_min (last hour /60)
- Akurasi tracking tergantung adapter Hermes parsing stdout — mock adapter random cost untuk dev

## 7. Backup System — `lib/server/backup.ts` + `scripts/backup.ts` + `deploy/`

- `runBackup()`:
  - ensure `data/backups/` exists
  - filename `backup-YYYY-MM-DD-HHMMSS.db`
  - `VACUUM INTO ?` (SQLite 3.27+ consistent snapshot, aman saat WAL mode) — fallback ke `fs.copyFileSync` jika gagal
  - stat size, log info, update `app_settings.last_backup` JSON
  - `cleanupOldBackups()` → delete file older than 30 days (retention)
- `listBackups()` → readdir .db files sorted reverse, max 50, return name,size,created_at
- Scheduler: `startBackupScheduler()` → setInterval every hour, if hour===3 and lastBackupDate !== today → runBackup() + lastBackupDate = today. Also startup check: if no backup today and hour>=3, schedule backup after 1 min (avoid race with migration)
- `stopBackupScheduler()` → clearInterval
- Started in bootstrap, stopped in graceful shutdown
- CLI: `scripts/backup.ts` → `npx tsx scripts/backup.ts` manual trigger + list recent 10
- API: `POST /api/mc/backups` manual trigger, `GET /api/mc/backups` list, `GET /api/mc/backups/:name` download (validate filename regex, prevent path traversal, check inside backup dir)
- Settings page Backup tab menampilkan list + Download button + DB path/size + info "otomatis harian jam 3 pagi"

## 8. Logging — `lib/server/logger.ts`

- `LogLevel`: debug 10, info 20, warn 30, error 40, `LOG_LEVEL` env default info prod, debug dev
- `shouldLog(level)` → check order
- `formatConsole()`: prod → JSON string {timestamp, level, message, module, requestId, taskId, agentId, ...metadata}, dev → pretty `${ts} LEVEL [module][req:id][task:id][agent:id] message key=value`
- `writeToDb()`: INSERT system_logs (level, message, source=module, task_id, metadata JSON) — skip debug untuk hindari penuhi DB
- `logger.debug/info/warn/error(msg, ctx)` + `logger.log(level, msg, ctx)`
- Legacy `writeSystemLog(level, message, source, taskId, metadata)` → wrapper ke logger.log
- `registerGlobalErrorHandlers()` → process.on uncaughtException → logger.error + exit 1 after 1s, unhandledRejection → logger.error
- Dipanggil sekali di bootstrap

Menggantikan semua `console.log` dengan `logger.info` etc secara bertahap (M11 polish).

## 9. Graceful Shutdown — `lib/server/bootstrap.node.ts`

- `register()` → import db, dispatcher, logger, backup scheduler
- Recovery stale tasks → queued + retry_count+1
- Start dispatcher + backup scheduler + log "Mission Control started"
- `shuttingDown` flag untuk hindari double shutdown
- `shutdown(signal)` async:
  - log info received signal
  - stopBackupScheduler()
  - stopGracefully 30s (wait active runs, reap, mark interrupted if timeout)
  - close DB (db.close())
  - log shutdown complete, exit 0
- Handlers: SIGTERM, SIGINT → shutdown

Health endpoint final: `GET /api/mc/health` → status ok/degraded/down, version, timestamp, startup_time, uptime_seconds, database connected/error, memory_mb, active_agents, queue_depth, last_error_at, worker_last_tick, last_backup_at, tasks {total,done,failed,running}, pending_approvals, cost_today_usd, env

## 10. Docker & Process Managers

**Docker multi-stage `deploy/Dockerfile`:**
- Stage deps: node:22-alpine + python3 make g++ libc6-compat + npm ci
- Stage builder: copy node_modules + source + npm run build (standalone output)
- Stage runner: node:22-alpine + libc6-compat + addgroup/adduser nextjs:nodejs + copy .next/standalone + .next/static + public + migrations + package.json + mkdir data/backups + chown + USER nextjs + EXPOSE 3000 + ENV PORT 3000 HOSTNAME 0.0.0.0 + HEALTHCHECK wget /api/mc/health + CMD node server.js

**docker-compose `deploy/docker-compose.yml`:**
- Build context .. dockerfile deploy/Dockerfile, image niu-mission-control:4.0, container_name, restart unless-stopped, ports 3000:3000, volumes ../data:/app/data (bind mount) or named volume mc-data, env_file ../.env.local, environment NODE_ENV production PORT 3000 MC_DB_PATH /app/data/swarm_state.db LOG_LEVEL info, healthcheck

**LaunchAgent `deploy/com.niumination.missioncontrol.plist`:**
- Label com.niumination.missioncontrol, Description, ProgramArguments /usr/local/bin/node /opt/niu-mission-control/apex-ui/server.js, WorkingDirectory /opt/niu-mission-control/apex-ui, RunAtLoad true, KeepAlive true + SuccessfulExit false + Crashed true + NetworkState true, ThrottleInterval 10, StandardOut/Error /opt/niu-mission-control/logs/*.log, EnvironmentVariables NODE_ENV production PORT 3000 HOSTNAME 0.0.0.0 MC_DB_PATH /opt/niu-mission-control/data/swarm_state.db LOG_LEVEL info PATH, HardResourceLimits NumberOfFiles 10240 MemoryLock 524288

**systemd `deploy/niumination-missioncontrol.service`:**
- Unit Description After network.target Wants network-online.target
- Service Type simple User niu Group niu WorkingDirectory /opt/niu-mission-control/apex-ui ExecStart /usr/bin/node /opt/niu-mission-control/apex-ui/server.js, Restart always RestartSec 10 StartLimitInterval 60 StartLimitBurst 3, Environment NODE_ENV production PORT 3000 HOSTNAME 0.0.0.0 MC_DB_PATH /opt/niu-mission-control/data/swarm_state.db LOG_LEVEL info + EnvironmentFile -/opt/niu-mission-control/.env.local and apex-ui/.env.local, StandardOutput/Error journal SyslogIdentifier, Security hardening NoNewPrivileges PrivateTmp ProtectSystem full ProtectHome read-only ReadWritePaths data logs, LimitNOFILE 10240 MemoryMax 1G, Install WantedBy multi-user.target

**start.sh `deploy/start.sh`:**
- Load .env.local from . and ../, mkdir data/backups logs, check build exists else npm run build, prefer server.js then .next/standalone/server.js then npm start, exec

## 11. UI Polish — M11

- ErrorBoundary: class component getDerivedStateFromError + componentDidCatch log to /api/mc/logs, fallback UI dengan icon AlertTriangle, error message, stack pre max 800 char, Retry button (reset state) + Go Home button, dipakai di (app)/layout.tsx wrap AppShell+Toast
- Skeleton: shimmer animation background linear-gradient 90deg 25% 50% 75% dengan background-size 200% 100% + keyframes skeleton-shimmer 1.5s infinite, components SkeletonCard (avatar + 3 lines + 3 stats grid), SkeletonTable, SkeletonChart
- EmptyState: reusable dengan variant no-data/no-results/error/no-tasks/no-agents, icon Inbox/Search/AlertCircle/FileX/Bot, title, description, action button gradient
- Design tokens: sudah di globals.css @theme --color-* --radius-* --spacing-* --shadow-* --ease-out-expo, dipakai di Tailwind dan hand-written
- WCAG AA: contrast 4.5:1 text, focus ring global :focus-visible outline 2px cyan, keyboard navigasi (tab, enter, escape), prefers-reduced-motion respect (belum full tapi animasi ada yang respect)
- Mobile breakpoints: minimal iPad 768px terpakai (grid auto-fill minmax), mobile phone tidak rusak (overflow auto)
- Toast system: zustand-based, success/error/info/warning, auto-dismiss 3.5s, slide-in, ToastViewport fixed bottom-right
- AppShell sidebar collapsible 210↔64px, persist localStorage, 7 nav items dengan accent color, active indicator bar, topbar dengan breadcrumb, search trigger ⌘K, clock/date real-time, bell dengan alert dot pulse, connection dot LIVE/DOWN, keyboard shortcuts ⌘K open palette, Esc home
- CommandPalette cmdk: Quick Actions Create new task inline POST /api/mc/dispatch, Navigate, Recent Tasks dari tasks store, Agents dari agents store, no results → dispatch as task CTA, backdrop blur

Semua komponen baru sudah pakai design tokens via CSS variables dan inline styles yang konsisten dengan tokens (cyan #00e5ff, amber #f5a623, emerald #34d399, red #ef4444, violet #a855f7, slate backgrounds).

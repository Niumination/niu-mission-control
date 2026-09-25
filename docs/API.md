# Mission Control API — v4.0 Aether

> **Base URL:** `http://localhost:3000/api`
> **Auth:** `X-API-Key` header atau session cookie (httpOnly, sameSite=strict)
> **Format:** JSON, validasi Zod di semua POST/PATCH
> **Runtime:** Node.js (bukan edge), `dynamic = force-dynamic`

## Auth

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/auth/login` | Login dengan password → set session cookie |
| POST | `/api/auth/logout` | Hapus session |
| POST | `/api/auth/setup` | First-run: generate password hash + API key + session secret → tulis `.env.local` |
| GET | `/api/auth/[...action]` | NextAuth-like catch-all (jika ada) |

Middleware melindungi semua `/api/mc/*` — redirect ke `/login` atau `/setup` jika belum auth.

## Health & System

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/mc/health` | Health check rich: status ok/degraded/down, version, uptime, memory_mb, database connected/error, active_agents, queue_depth, last_error_at, worker_last_tick, last_backup_at, tasks counts, pending_approvals, cost_today_usd |
| HEAD | `/api/mc/health` | Simple 200 untuk load balancer |
| GET | `/api/mc/events` | SSE stream: `text/event-stream`, replay via `Last-Event-ID`, auto-reconnect client, filter `?types=task.*,agent.*` |
| GET | `/api/mc/logs?level&source&search&limit&offset&include_events` | System logs + recent events combined, untuk Live Ops |
| GET | `/api/mc/metrics?range=24h|7d|30d` | Aggregated metrics untuk Analytics: summary, costs, charts (tasks_per_day, cost_per_agent, tokens_per_model, success_per_agent, etc) |
| GET | `/api/mc/backups` | List backup files |
| POST | `/api/mc/backups` | Trigger manual backup (VACUUM INTO) |
| GET | `/api/mc/backups/:name` | Download backup file (octet-stream) |

## Agents

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/mc/agents` | List agents dengan stats: total_tasks, completed, failed, running, pending, total_cost_usd, success_rate, avg_duration_sec, current_task_id/title, sparkline_24h (24 buckets) |
| POST | `/api/mc/agents` | Create agent (admin): id, name, role, description, color hex, model_default, adapter, system_prompt |
| GET | `/api/mc/agents/:id` | Detail: agent row + stats + cost (total + by_model) + recent_tasks 20 + activity_7d + logs 50 |
| PATCH | `/api/mc/agents/:id` | Update config: name, role, description, color, model_default, system_prompt, enabled (0/1), status |

Seed 5 default agents jika DB kosong: chief (mock), research, programmer, qa, creator (hermes).

## Tasks — State Machine: inbox → queued → running → review → done | failed | cancelled

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/mc/tasks?status&agent&priority&search&limit&offset` | List tasks grouped: {inbox, queued, running, review, done, failed, cancelled, total, limit, offset}. Support filter & search title/desc/id |
| POST | `/api/mc/dispatch` | Create task (alias): title, description, instruction, agent, priority, source, depends_on, idempotency_key, deadline_at, metadata. Generate id `t${base36 timestamp}${random hex}`, insert queued, emit task.queued |
| GET | `/api/mc/dispatch?status&agent&priority&search&limit&offset` | Alias list tasks terbaru |
| GET | `/api/mc/tasks/:id` | Detail: task + timeline events + artifacts + costs (cost_tracking aggregated) |
| PATCH | `/api/mc/tasks/:id` | Update: status (validasi via VALID_TRANSITIONS dari state-machine.ts, 409 jika ilegal), priority, title, description, progress, result, error_message, metadata. Emit event + set timestamps (queued_at, claimed_at, started_at, submitted_at, completed_at, failed_at) |
| DELETE | `/api/mc/tasks/:id` | Cancel task: set cancelled jika belum terminal, emit task.cancelled |

**VALID_TRANSITIONS (single source of truth `lib/server/state-machine.ts`):**
- inbox → queued, cancelled
- queued → running, cancelled
- running → review, failed, cancelled
- review → done, failed, cancelled, queued (rework)
- failed → queued (retry), cancelled
- done, cancelled → terminal (no outgoing)

TaskId regex: `^t[a-z0-9]+$` (contoh `tmuh6y0dj96ed1e`).

## Approvals — Human-in-the-Loop Gates

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/mc/approvals?status=pending|approved|rejected|expired&limit=20` | List approvals dengan join task_title, agent_name, payload parsed JSON |
| POST | `/api/mc/approvals/:id/approve` | Approve: set approvals status approved, task → queued (resume), agents idle, emit approval.approved + task.queued + alert.resolved, audit |
| POST | `/api/mc/approvals/:id/reject` | Reject: set approvals rejected, task → failed dengan error_message `Rejected by actor: reason`, agents idle, emit approval.rejected + task.failed + alert.resolved |

Action types yang butuh approval (configurable): `shell_exec`, `external_send`, `deploy`, `file_delete`, `db_mutation`. Timeout auto-reject 1 jam via `expireOldApprovals()` (dipanggil dispatcher).

## Audit & Settings

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/mc/audit?actor&action&target_type&search&limit&offset&from&to` | List audit_log immutable, dengan distinct filters meta (actors, actions, target_types) |
| GET | `/api/mc/settings` | List app_settings (parsed JSON) + raw + backups list + env info (node_env, db_path, db_size, backup_count, agents_count, version) |
| PUT | `/api/mc/settings` | Bulk upsert: {settings: [{key, value}]} → INSERT ON CONFLICT DO UPDATE + audit settings.update |

`app_settings` keys umum: `worker_last_tick`, `last_backup`, `instance_name`, `timezone`, `theme`, `hermes_path`, `mock_adapter_enabled`, `telegram_chat_id`, `alert_on_error`, `alert_on_approval`, `session_timeout_min`, `daily_budget_usd`, `monthly_budget_usd`, dll.

## Telegram

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/mc/telegram/send` | Kirim pesan Telegram via Hermes CLI atau Bot API fallback: {message, topic_id}. Validasi topic_id enum 1,802,803,804,1172 |

## Weather (contoh)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/weather` | Proxy open-meteo untuk weather widget di overview |

## Event Types (SSE)

`task.created`, `task.queued`, `task.claimed`, `task.started`, `task.progress`, `task.submitted`, `task.completed`, `task.failed`, `task.cancelled`, `task.retrying`, `agent.heartbeat`, `agent.online`, `agent.offline`, `agent.working`, `agent.idle`, `approval.requested`, `approval.approved`, `approval.rejected`, `alert.raised`, `alert.resolved`, `dispatch.sent`, `system.cost_recorded`, `dispatcher.started`, `dispatcher.stopped`

Setiap event persist ke `events` table (id autoincrement) untuk replay via `Last-Event-ID`.

## Error Format

```json
{
  "error": "Invalid status transition: running → done",
  "details": [{ "field": "status", "message": "Invalid transition" }]
}
```

Status codes: 400 validation, 401 unauth, 404 not found, 409 conflict (invalid transition, duplicate id), 500 internal.

## Rate Limiting & Security

- Auth selalu-on (tidak ada dev mode tanpa auth)
- Session cookie httpOnly, secure (prod), sameSite=strict
- API key timing-safe compare
- Zod validation 100% POST/PATCH
- Shell exec hanya via adapter terkontrol, execFile array args, shell=false, cwd locked
- Secrets hanya dari env, fail-fast jika wajib kosong
- CSP headers: X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy same-origin
- Audit log immutable (append-only, no DELETE API)
- SQLite WAL mode, foreign_keys=ON, busy_timeout 5000, transaction untuk mutasi

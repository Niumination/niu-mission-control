# Niu-MissionControl v2.6.2 — Orchestrator Rules

## Arsitektur

```
Commander (User)
    ↓ Dashboard (localhost:5200) atau Telegram
    ↓
Niu-MissionControl (FastAPI + WebSocket)
    ├── REST API: 39 endpoints + /health
    ├── WebSocket: /ws/swarm (real-time feed)
    ├── Auth: X-API-Key header (opsional via MC_API_KEY)
    ├── CORS: configurable (MC_CORS_ORIGINS)
    ├── Rate Limit: 60 req/min per IP
    └── SQLite WAL: swarm_state.db
    ↓
SwarmBus (IPC Layer)
    ├── Chief (Orchestrator) → route tasks
    ├── Research Agent → scraping, docs, blueprints
    ├── Programmer Agent → write/modify code
    ├── QA Agent → run tests, capture output
    └── Creator Agent → konten, copywriting, storytelling
    ↓
Hermes Bridge (Telegram → Gateway → Agent)
    ↓
Hermes Gateway (launchd, PID managed)
```

## Swarm Topology (5 Agents)

| ID | Name | Role | Telegram Topic |
|----|------|------|----------------|
| `chief` | Hermes Chief | Orchestrator / Commander | 1 (General) |
| `research` | Agent 01 | Research & Learn | 802 (MC-Research) |
| `programmer` | Agent 02 | Programmer & Coder | 803 (MC-Programmer) |
| `qa` | Agent 03 | Tester & QA | 804 (MC-QA) |
| `creator` | Agent 04 | Content Creator | 1172 (MC-Konten Kreator) |

Commander (user) memantau & berinteraksi langsung via dashboard + Telegram.
Agent bekerja **paralel** — Chief delegate, 4 agent eksekusi bersamaan.

## Port & Addresses

| Service | Port | Protocol |
|---------|------|----------|
| Mission Control | 5200 | HTTP/WS |
| Hermes Gateway | — | launchd managed |

## Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `MC_API_KEY` | _(empty = auth disabled)_ | API key untuk akses endpoints |
| `MC_CORS_ORIGINS` | `http://localhost:5200` | Comma-separated allowed origins |
| `MC_RATE_LIMIT` | `60` | Max requests per minute per IP |
| `HERMES_HOME` | `/Volumes/HermesAgent/HermesAgentUSB/data` | Hermes config directory |
| `HERMES_TELEGRAM_CHAT_ID` | `-REDACTED_CHAT_ID` | Telegram group chat ID |

## API Endpoints

| Method | Path | Auth | Deskripsi |
|--------|------|:----:|-----------|
| GET | `/health` | No | Health check (monitoring) |
| GET | `/api/mc/system` | Yes | System health metrics |
| GET | `/api/mc/hermes` | Yes | Hermes gateway + cron status |
| GET | `/api/mc/agents` | Yes | Agent swarm status |
| GET | `/api/mc/tasks` | Yes | Task kanban board |
| GET | `/api/mc/logs` | Yes | Agent log feed |
| POST | `/api/mc/task-update` | Yes | Update task status (callback) |
| POST | `/api/mc/delegate` | Yes | Delegate task to agent |
| POST | `/api/mc/run-terminal` | Yes | Execute shell command |
| POST | `/api/mc/send-telegram` | Yes | Send Telegram message |
| GET | `/api/mc/artifacts` | Yes | List artifact files |
| GET | `/api/mc/artifact-content` | Yes | Read artifact file content |
| GET | `/api/mc/config` | Yes | Get swarm config |
| POST | `/api/mc/config` | Yes | Save swarm config |
| POST | `/api/mc/clear-logs` | Yes | Clear all logs/tasks |
| POST | `/api/mc/wal-checkpoint` | Yes | SQLite WAL checkpoint |
| WS | `/ws/swarm` | No | Real-time swarm stream |

## Authentication

Set `MC_API_KEY` environment variable untuk mengaktifkan auth:

```bash
export MC_API_KEY="your-secret-key-here"
```

Semua API endpoint (kecuali `/health` dan `/`) memerlukan header:

```
X-API-Key: your-secret-key-here
```

Tanpa header yang valid, server mengembalikan `401 Unauthorized`.

## Rate Limiting

Default: **60 requests per minute per IP**. Atur via `MC_RATE_LIMIT`:

```bash
export MC_RATE_LIMIT=120  # 120 req/min
```

Melebihi batas mengembalikan `429 Too Many Requests`.

## CORS

Default: hanya `localhost:5200` dan `127.0.0.1:5200`. Atur via `MC_CORS_ORIGINS`:

```bash
export MC_CORS_ORIGINS="http://localhost:5200,https://mydomain.com"
```

## Running Tests

```bash
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

## Graceful Shutdown

Server menangani SIGTERM dan SIGINT dengan:
1. Menutup semua WebSocket connections
2. Menutup SQLite database connection
3. Logging shutdown event

## Data Flow

```
1. User ketik instruksi di Dashboard General topic
2. POST /api/mc/send-telegram → hermes_bridge.send_chat()
3. hermes CLI → Telegram Group (Topic 1)
4. Hermes Agent (via Telegram) → execute task
5. Agent callback → POST /api/mc/task-update
6. WebSocket broadcast → Dashboard update real-time
```

## USB-Safe Mode

- SQLite WAL mode aktif untuk prevent corruption
- Manual checkpoint via button di dashboard atau POST /api/mc/wal-checkpoint
- Temporary files di /tmp (RAM disk), bukan USB
- ThrottleInterval: 30s antara restart (crash-loop protection)

## Thread Dispatch Pipeline (v2.7 — 2026-08-14)

Pipeline resmi untuk menugaskan agent antar-thread (general → QA/programmer/research/kreator).

### Alur
```
1. POST /api/mc/dispatch  {to: "804", message: "...", source: "general"}
2. Record pending di data/dispatches.json + broadcast WS (dashboard realtime)
3. Background task:
   a. Kirim notifikasi ke topic target (hermes send, retry 2x30s)
   b. Trigger agent: hermes -z "<message>" --resume <session_thread> -m <model> --provider 9router
   c. Status → done/error + simpan result di record
   d. Kirim hasil balik ke topic target
   e. Broadcast update WS
```

### Endpoint
- `POST /api/mc/dispatch` — kirim + trigger (return instan, async di background)
- `GET /api/mc/dispatches?limit=20` — riwayat + status
- WS `/ws/swarm` — broadcast event `{type:"dispatch", dispatch:{...}}` + snapshot berisi `dispatches`

### Status lifecycle
`pending` → `sent` (notifikasi terkirim) → `done` (agent selesai, ada result) | `error`

### Mapping thread (session_id + model)
| Thread | Session | Model |
|--------|---------|-------|
| 1 general | 20260718_020326_cbee9e | gemini-3.5-flash-lite |
| 802 research | 20260725_180757_8bfbcc82 | gc/gemini-2.5-pro |
| 803 programmer | 20260725_180825_de730f23 | deepseek-r1-distill-qwen-32b |
| 804 qa | 20260725_180822_1ff5b715 | glm-4.7-flash |
| 1172 kreator | 20260809_114955_fe915d35 | gemma-4-31b-it |

### Dashboard
View DISPATCH di /aios: form kirim perintah + riwayat realtime (status pill + result preview).

### Catatan
- Directives thread di config.yaml (platforms.telegram.extra.channel_prompts) — thread 1 sudah diinstruksikan pakai /api/mc/dispatch untuk menugaskan agent lain.
- Session ID berubah saat thread di-reset (/new) — update THREAD_SESSIONS di modules/dispatch_store.py.

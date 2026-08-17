# Niu-MissionControl API Specification

> **Version:** 3.0.0 · **Base URL:** `http://localhost:5200`
> **Auth:** `X-API-Key` header required for `/api/*` endpoints

## Endpoints

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth) |
| GET | `/api/mc/system` | System info (uptime, OS, Python) |
| GET | `/api/mc/hermes` | Hermes gateway status |
| GET | `/api/mc/config` | Get configuration |
| POST | `/api/mc/config` | Update configuration |
| POST | `/api/mc/wal-checkpoint` | Trigger SQLite WAL checkpoint |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mc/tasks` | List tasks (kanban view) |
| POST | `/api/mc/task-update` | Update task status |
| POST | `/api/mc/delegate` | Delegate task to agent |
| GET | `/api/mc/logs` | Log feed (filterable) |
| GET | `/api/mc/errors` | Error count |
| POST | `/api/mc/clear-logs` | Clear old logs |

### Orchestration
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/mc/dispatch` | Submit task (with idempotency_key) |
| POST | `/api/mc/approve/{task_id}` | Approve dangerous action |
| POST | `/api/mc/reject/{task_id}` | Reject dangerous action |
| GET | `/api/mc/audit` | Audit log |

### Agents
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mc/agents` | Agent fleet status |
| GET | `/api/mc/ecosystem` | Ecosystem overview |

### Terminal
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/mc/run-terminal` | Run terminal command (read-only) |

### Routines
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mc/routines` | List routines |
| POST | `/api/mc/routine/run` | Run a routine |

### Telegram
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mc/telegram-feed` | Telegram feed |
| POST | `/api/mc/send-telegram` | Send message to Telegram |

### Artifacts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mc/artifacts` | List artifacts |
| GET | `/api/mc/artifact-content` | Get artifact content |
| POST | `/api/mc/artifact/version` | Record version |
| GET | `/api/mc/artifact/versions` | Version history |
| GET | `/api/mc/artifact/diff` | Diff between versions |

### Skills
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mc/skills` | Skill bank status |
| GET | `/api/mc/skills/stats` | Skill usage stats |
| GET | `/api/mc/skills/stale` | Stale skills |
| GET | `/api/mc/skills/conflicts` | Skill conflicts |

### Cost
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mc/cost/task/{task_id}` | Cost per task |
| GET | `/api/mc/cost/agent/{agent_id}` | Cost per agent |
| GET | `/api/mc/cost/agents` | Cost summary |

### WebSocket
| Method | Path | Description |
|--------|------|-------------|
| WS | `/ws/swarm` | Live swarm topology |
| POST | `/api/mc/ws/start` | Start WS session |
| POST | `/api/mc/ws/stop/{id}` | Stop WS session |
| GET | `/api/mc/ws/sessions` | List WS sessions |

### Observability
| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics` | Prometheus-style metrics |
| GET | `/api/mc/alerts` | Current alerts |

### Public (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Unified dashboard |
| GET | `/orb` | ORB standalone |
| GET | `/dashboard` | Legacy dashboard |
| GET | `/aios` | AI OS view |

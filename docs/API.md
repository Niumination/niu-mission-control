# Mission Control API — Next.js (apex-ui)

> **Update 24 Sep 2026:** Backend `server.py` (FastAPI) telah Dihapus dalam rapikan audit.
> API sekarang sepenuhnya Next.js Route Handlers di `apex-ui/app/api/`.

## Base

- URL: `http://localhost:5200/api/mc/*`
- Auth: `X-API-Key` header (jika dikonfigurasi)
- Format: JSON

## Endpoints

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/mc/health` | Health check — status DB + uptime |
| GET | `/api/mc/tasks` | List tasks (kanban view) |
| POST | `/api/mc/tasks/update` | Update task status |
| GET | `/api/mc/dispatches` | List dispatches |
| POST | `/api/mc/dispatch` | Dispatch task ke agent (idempotency_key) |
| GET | `/api/mc/agents` | List agents |
| POST | `/api/mc/telegram/send` | Kirim pesan Telegram |
| GET | `/api/weather` | Weather endpoint |

## Legacy

Endpoint FastAPI lama (`/api/mc/system`, `/api/mc/hermes`, `/api/mc/config`,
`/api/mc/delegate`, `/api/mc/logs`, `/api/mc/approve/{id}`, dsb.) tidak lagi ada —
`server.py` dihapus 24 Sep 2026. Riwayat ada di branch `legacy-ui`.
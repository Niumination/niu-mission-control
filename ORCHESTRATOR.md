# Niu-MissionControl — Orchestrator Rules

Berdasarkan NotebookLM "mission-control" spec.

1. **Dashboard = monitoring + control.** Bukan menjalankan agent sendiri —
   delegate via Telegram bridge ke Hermes swarm.
2. **FastAPI + WebSocket + SwarmBus** (aiosqlite WAL) — verified pattern.
3. **HOME mismatch:** `hermes send` butuh `HERMES_HOME=/Volumes/HermesAgent/HermesAgentUSB/data`
   (tempat `.env` dengan TELEGRAM_BOT_TOKEN). Jangan pakai HOME portable.
4. **Topic IDs** dari `createForumTopic` (auto): 802=Research, 803=Programmer, 804=QA, 1=General.
5. **Never commit secrets:** `.env`, `cookies.txt`, `*.db`, `*.db-wal` → gitignore.
6. **Callback, not polling:** Gateway consumes bot `getUpdates` → MC gak poll Telegram.
   Agent panggil `POST /api/mc/task-update` saat selesai.
7. **USB-safe:** WAL mode + `synchronous=NORMAL` + `busy_timeout=5000` + `temp_store=MEMORY`.

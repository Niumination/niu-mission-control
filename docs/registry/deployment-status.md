# Deployment Status — Niu-Mission-Control v4.0 Aether

**Updated:** 26 Sep 2026

| Environment | Method | Status | Details |
|---|---|---|---|
| **Local Dev** | `npm run dev` | 🟢 Live | localhost:3000, password `apex`, SSE 10/10, build 106s |
| **Docker** | `deploy/Dockerfile` multi-stage deps→builder→runner node:22-alpine non-root nextjs, `deploy/docker-compose.yml` | 🟢 Ready | Image `niu-mission-control:4.0`, bind `../data:/app/data`, env_file `../.env.local`, healthcheck wget `/api/mc/health`, restart unless-stopped |
| **LaunchAgent (macOS)** | `deploy/com.niumination.missioncontrol.plist` | 🟢 Ready | Label com.niumination.missioncontrol, RunAtLoad true, KeepAlive Crashed+NetworkState true, logs /opt/niu-mission-control/logs/, NetworkState WAJIB per DOX |
| **systemd (Linux)** | `deploy/niumination-missioncontrol.service` | 🟢 Ready | User niu, Restart always, hardening NoNewPrivileges PrivateTmp ProtectSystem full, ReadWritePaths data logs backups, MemoryMax 1G |
| **start.sh** | `deploy/start.sh` | 🟢 Ready | Load .env.local, mkdir backups logs, check build, prefer server.js → standalone → npm start |
| **Vercel** | Landing only (optional) | ⚪ Not yet | Mission-control self-hosted karena SQLite + better-sqlite3 native, tapi landing page minimal bisa di Vercel seperti PemdiAcehTengah & Niu-OSS-Dashboard |

**Health:** `/api/mc/health` → status ok/degraded/down, uptime, memory, queue_depth, active_agents, tasks total/done/failed/running, pending_approvals, cost_today, last_backup_at, env

**Backup:** `data/backups/backup-YYYY-MM-DD-HHMMSS.db` VACUUM INTO daily 3AM retention 30d via scheduler + manual POST `/api/mc/backups` + download GET `/api/mc/backups/:name` + CLI `npx tsx scripts/backup.ts`

**Logs:** Structured JSON di prod (`LOG_LEVEL` env), pretty di dev, `system_logs` table, global handlers uncaughtException + unhandledRejection, graceful shutdown 30s

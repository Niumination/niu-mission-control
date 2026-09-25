# Deploy — Niumination Mission Control v4.0 Aether

## Docker (Recommended for Linux server)

```bash
# 1. Build image (from repo root or apex-ui)
cd apex-ui
docker build -f deploy/Dockerfile -t niu-mission-control:4.0 ..

# 2. Create .env.local if not exists (first-run setup will also work via /setup page)
cp ../.env.example ../.env.local
# Edit .env.local: MC_PASSWORD_HASH, MC_API_KEY, MC_SESSION_SECRET, etc
# Atau biarkan kosong, nanti /setup wizard akan generate

# 3. Run via compose
docker compose -f deploy/docker-compose.yml up -d

# 4. Check health
curl http://localhost:3000/api/mc/health
docker logs -f niu-mission-control
docker compose -f deploy/docker-compose.yml ps

# 5. Backup
# Backup dir is bind-mounted to ../data/backups
ls ../data/backups/
# Manual trigger via API:
curl -X POST http://localhost:3000/api/mc/backups -H "X-API-Key: $MC_API_KEY"
```

**Dockerfile multi-stage:**
- Stage deps: node:22-alpine + python3 make g++ for better-sqlite3 native build + npm ci
- Stage builder: copy node_modules + source + npm run build (standalone output .next/standalone/server.js + static)
- Stage runner: node:22-alpine + libc6-compat + non-root user nextjs (1001) + copy standalone + static + public + migrations + package.json + mkdir data/backups + chown + EXPOSE 3000 + HEALTHCHECK wget /api/mc/health + CMD node server.js

**docker-compose.yml:**
- Build context .., dockerfile deploy/Dockerfile
- Image niu-mission-control:4.0, container_name, restart unless-stopped
- Ports 3000:3000
- Volumes ../data:/app/data (persist DB + backups) — alternative named volume mc-data
- env_file ../.env.local + environment NODE_ENV production PORT 3000 MC_DB_PATH /app/data/swarm_state.db LOG_LEVEL info
- Healthcheck

## macOS LaunchAgent (for local dev machine)

```bash
# 1. Copy plist to ~/Library/LaunchAgents/
cp deploy/com.niumination.missioncontrol.plist ~/Library/LaunchAgents/

# 2. Edit paths if your install path differs from /opt/niu-mission-control
#    WorkingDirectory and ProgramArguments and StandardOutPath/ErrorPath
#    For local dev:
#    WorkingDirectory = /Users/YOU/path/to/niu-mission-control/apex-ui
#    ProgramArguments = /opt/homebrew/bin/node /Users/YOU/.../apex-ui/.next/standalone/server.js

# 3. Create logs dir
mkdir -p /opt/niu-mission-control/logs
# Or for local: mkdir -p ~/Library/Logs

# 4. Load & start
launchctl load ~/Library/LaunchAgents/com.niumination.missioncontrol.plist
launchctl start com.niumination.missioncontrol

# 5. Check
launchctl list | grep missioncontrol
ps aux | grep mission-control
curl http://localhost:3000/api/mc/health
tail -f /opt/niu-mission-control/logs/mission-control.stdout.log

# 6. Test auto-restart (kill -9)
ps aux | grep "[s]erver.js"
kill -9 <PID>
# Wait 10s, should restart automatically because KeepAlive true
launchctl list | grep missioncontrol

# 7. Unload
launchctl unload ~/Library/LaunchAgents/com.niumination.missioncontrol.plist
```

**Plist details:**
- Label com.niumination.missioncontrol, Description v4.0 Aether
- ProgramArguments node server.js (standalone)
- WorkingDirectory /opt/niu-mission-control/apex-ui
- RunAtLoad true, KeepAlive true + SuccessfulExit false + Crashed true + NetworkState true, ThrottleInterval 10
- StandardOut/Error to logs
- EnvironmentVariables NODE_ENV production PORT 3000 HOSTNAME 0.0.0.0 MC_DB_PATH /opt/niu-mission-control/data/swarm_state.db LOG_LEVEL info PATH
- HardResourceLimits NumberOfFiles 10240

## Linux systemd (for production server)

```bash
# 1. Copy service file
sudo cp deploy/niumination-missioncontrol.service /etc/systemd/system/

# 2. Edit User/Group and paths if needed
sudo nano /etc/systemd/system/niumination-missioncontrol.service
# User=niu Group=niu WorkingDirectory=/opt/niu-mission-control/apex-ui
# ExecStart=/usr/bin/node /opt/niu-mission-control/apex-ui/server.js
# EnvironmentFile=-/opt/niu-mission-control/.env.local

# 3. Create data & logs dirs and set ownership
sudo mkdir -p /opt/niu-mission-control/data/backups /opt/niu-mission-control/logs
sudo chown -R niu:niu /opt/niu-mission-control

# 4. Reload & enable
sudo systemctl daemon-reload
sudo systemctl enable --now niumination-missioncontrol
sudo systemctl status niumination-missioncontrol
journalctl -u niumination-missioncontrol -f

# 5. Test restart
sudo systemctl kill -s SIGKILL niumination-missioncontrol
# Wait, should auto-restart (Restart always)
sudo systemctl status niumination-missioncontrol

# 6. Stop/disable
sudo systemctl stop niumination-missioncontrol
sudo systemctl disable niumination-missioncontrol
```

**Service hardening:**
- NoNewPrivileges, PrivateTmp, ProtectSystem full, ProtectHome read-only, ReadWritePaths data logs
- LimitNOFILE 10240, MemoryMax 1G
- Restart always, RestartSec 10, StartLimitInterval 60 StartLimitBurst 3
- EnvironmentFile for secrets

## Manual via start.sh

```bash
cd apex-ui
chmod +x deploy/start.sh
./deploy/start.sh
# Loads .env.local from . and ../, mkdir backups logs, checks build else npm run build, prefers server.js then .next/standalone/server.js then npm start
```

## Backup & Restore

```bash
# Manual backup via CLI
cd apex-ui
npx tsx scripts/backup.ts
# Or via API
curl -X POST http://localhost:3000/api/mc/backups -H "X-API-Key: $MC_API_KEY"

# List backups
curl http://localhost:3000/api/mc/backups -H "X-API-Key: $MC_API_KEY" | jq
ls data/backups/

# Download backup
curl -O http://localhost:3000/api/mc/backups/backup-2026-09-25-030000.db -H "X-API-Key: $MC_API_KEY"

# Restore (stop server first)
# For safety, copy current DB to backup, then replace
cp data/swarm_state.db data/swarm_state.db.pre-restore
cp data/backups/backup-2026-09-25-030000.db data/swarm_state.db
# Restart server
```

**Backup system:**
- VACUUM INTO (SQLite 3.27+ consistent snapshot, safe during WAL) fallback to file copy
- Filename backup-YYYY-MM-DD-HHMMSS.db
- Retention 30 days, cleanup old
- Scheduler daily 3 AM (hourly check, once per day), startup check if no backup today and hour>=3 schedule after 1 min
- Started in bootstrap, stopped in graceful shutdown
- API list + trigger + download with path traversal protection
- Settings → Backup tab list + Manual Backup + Download

## Health & Monitoring

```bash
curl http://localhost:3000/api/mc/health | jq
# {
#   status: ok|degraded|down,
#   version, timestamp, startup_time, uptime_seconds,
#   database: connected|error, memory_mb,
#   active_agents, queue_depth, last_error_at, worker_last_tick, last_backup_at,
#   tasks: {total,done,failed,running}, pending_approvals, cost_today_usd, env
# }

# Degraded if queue_depth>20 or worker_last_tick>60s
# Down if database error
```

## Logging

- Structured JSON logger `lib/server/logger.ts`: prod JSON {timestamp,level,message,module,requestId,taskId,agentId,...}, dev pretty
- Levels: debug 10, info 20, warn 30, error 40, LOG_LEVEL env default info prod debug dev
- Write to system_logs DB (skip debug) + console
- Global handlers: uncaughtException → error log + exit 1 after 1s, unhandledRejection → error log
- Use `logger.info/warn/error/debug(msg, {module, requestId, taskId, agentId, ...})` instead of console.log
- Logs viewable in /live-ops LogViewer (SSE + DB polling 5s) and /api/mc/logs

## Graceful Shutdown

- SIGTERM/SIGINT → stopBackupScheduler + dispatcher.stopGracefully(30000) → wait active runs max 30s polling 500ms + reap, if still active mark interrupted queued + error_message + agents idle + adapter.cancel best-effort, clear activeRuns, close DB, exit 0
- Recovery on startup: SELECT running tasks → queued + retry_count+1 + error_message "Recovered from restart"

## Troubleshooting

- **DB locked:** Check `lsof data/swarm_state.db`, ensure only one process, WAL mode should handle concurrent reads, busy_timeout 5000
- **Hermes adapter unavailable:** Check HERMES_PATH env, `which hermes`, logs in /live-ops, agent status will be offline
- **SSE not connecting:** Check reverse proxy config (should allow text/event-stream, no buffering), fallback polling 10s will work, check /api/mc/events directly
- **Build fails due to better-sqlite3 native:** Ensure python3 make g++ installed (apk add python3 make g++ libc6-compat for Alpine, or xcode-select --install for macOS)
- **Backup fails:** Check data/backups writable, DB path exists, SQLite version supports VACUUM INTO (3.27+), fallback to copy should work
- **LaunchAgent not starting:** Check StandardOutPath writable, WorkingDirectory exists, node path correct (/opt/homebrew/bin/node vs /usr/local/bin/node), `launchctl list` for exit code, `launchctl start` manual
- **systemd fails:** Check journalctl, User exists, WorkingDirectory exists, EnvironmentFile path, ReadWritePaths
```


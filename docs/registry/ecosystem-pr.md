# PR — ecosystem-config registry sync v4.1 Aether Sync

**Target Repo:** `github.com/Niumination/ecosystem-config`  
**Branch:** `main`  
**Files to update:**

## 1. README.md — Services section

Current (outdated):
```
| **niu-mission-control** | FastAPI/WebSocket | **P2 ⬆** | 🟢 Active |
```

Proposed:
```
| **niu-mission-control** | Next.js 16.3.5 / SQLite WAL + better-sqlite3 / SSE + Zustand / Tailwind 4 / R3F | **P2 ⬆** | 🟢 Active | v4.1.0 Aether Sync | Docker + LaunchAgent + systemd + PWA + i18n + vitest 12/12 + a11y 7/7 |
```

## 2. docs/registry/project-catalog.md

Tambah/update entry:

```md
### services/niu-mission-control

- **Path:** `services/niu-mission-control/`
- **Repo:** `github.com/Niumination/niu-mission-control`
- **Stack:** Next.js 16.3.5 + React 19.2.8 + TS 5.9.2 + SQLite WAL + better-sqlite3 + SSE + Zustand + SWR + Tailwind 4 + dnd-kit + cmdk + R3F + PWA + i18n
- **Version:** v4.1.0 Aether Sync (2026-09-26) — sebelumnya v4.0.0 Aether (2026-09-25)
- **Status:** 🟢 Active — self-hosted AI Agent Control Plane, build hijau 9.7s, First Load 101kB, SSE 10/10, vitest 12/12, a11y 7/7, PWA offline, i18n 100 keys ID/EN, API v1 alias, budget kill-switch
- **Deploy:** Docker multi-stage node:22-alpine + compose + LaunchAgent plist com.niumination.missioncontrol (NetworkState true) + systemd niumination-missioncontrol.service (hardening) + start.sh + health /api/mc/health + backup VACUUM INTO daily 3AM retention 30d
- **Maturity:** Production
- **DOX:** AGENTS.md root + docs/dox/INDEX.md + .githooks/pre-commit secret-scan + .nvmrc 22
- **Integrasi:** niu-dash inventory 112→113, Niu-OSS-Dashboard aggregator 90→91, hermes-agent gateway+CLI+mock fallback chain
```

## 3. docs/registry/deployment-status.md

Tambah:

```md
### niu-mission-control

- **Docker:** `niu-mission-control:4.1` image, `../data:/app/data` bind, env_file `../.env.local`, healthcheck wget /api/mc/health, restart unless-stopped, logging json-file max-size 10m
- **LaunchAgent:** `com.niumination.missioncontrol.plist` Label com.niumination.missioncontrol, RunAtLoad true, KeepAlive Crashed+NetworkState true, logs /opt/niu-mission-control/logs/, NetworkState WAJIB per DOX v4.0
- **systemd:** `niumination-missioncontrol.service` User niu, Restart always, hardening NoNewPrivileges PrivateTmp ProtectSystem full, ReadWritePaths data logs backups, MemoryMax 1G
- **Health:** /api/mc/health + /api/v1/mc/health alias → status ok/degraded/down, uptime, memory, queue_depth, active_agents, tasks total/done/failed/running, pending_approvals, cost_today, last_backup_at
- **Backup:** data/backups/backup-YYYY-MM-DD-HHMMSS.db VACUUM INTO daily 3AM retention 30d + manual POST /api/mc/backups + download GET /api/mc/backups/:name + CLI npx tsx scripts/backup.ts
- **CI:** tsc 0 + vitest 12/12 + build 11 pages + SSE 10/10 + a11y 7/7
```

## 4. docs/registry/model-mapping.md

Tambah:

```md
### niu-mission-control adapters

- mock: MockAdapter delay 2-8s 85% success 10% approval
- hermes-cli: HermesCLIAdapter execFile shell=false, HERMES_PATH env
- hermes-gateway: HermesGatewayAdapter HTTP HERMES_GATEWAY_URL env, probe GET /health HTTP-200 (future)
- Fallback chain: gateway → CLI → mock, probe HTTP-200 before mencatat
```

## PR Message

```
feat(registry): sync niu-mission-control v4.1 Aether Sync — Next 16 + DOX + PWA + i18n

- Update README services: FastAPI/WebSocket → Next.js 16.3.5 / SQLite WAL / SSE / Zustand / Tailwind 4
- project-catalog: v4.1.0 Aether Sync, build 9.7s, First Load 101kB, vitest 12/12, a11y 7/7, PWA, i18n 100 keys, API v1 alias, budget kill-switch
- deployment-status: Docker 4.1 + compose + LaunchAgent NetworkState + systemd hardening + health + backup
- model-mapping: mock + hermes-cli + hermes-gateway fallback chain

Gold standard alignment: Niu-OSS-Dashboard Next 16.3.5 pattern, DOX v4.0 compliance (AGENTS.md + .githooks + docs reorg + .nvmrc 22)

Test: tsc 0, vitest 12/12, build 11 pages, SSE 10/10 (9/10 di Next 16 dev due to slow tick — need DB singleton fix)
```

## Checklist

- [ ] Selective git add (never git add .)
- [ ] DOX pass: update docs/registry/*
- [ ] Secret scan: git config core.hooksPath .githooks
- [ ] PR kecil per file atau satu PR registry
- [ ] Link ke SYNC_PLAN v4.1

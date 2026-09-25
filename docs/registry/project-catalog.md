# Project Catalog — Niu-Mission-Control

**Path:** `services/niu-mission-control/`  
**Repo:** `github.com/Niumination/niu-mission-control`  
**Stack:** Next.js 16 (target) / SQLite WAL + better-sqlite3 + SSE + Zustand + Tailwind 4 + R3F  
**Version:** v4.0.0 Aether (dev ready) → v4.1.0 Aether Sync (target)  
**Status:** 🟢 Active — self-hosted AI Agent Control Plane  
**Deploy:** Docker multi-stage + docker-compose + LaunchAgent plist + systemd + start.sh (self-hosted, bukan Vercel)  
**Maturity:** Production — 14 endpoints, WAL+foreign_keys ON+busy_timeout 5000, VALID_TRANSITIONS single source, Zod 100%, auth httpOnly+timing-safe, SSE singleton globalThis+Last-Event-ID, orb living, AppShell 210↔64 + CommandPalette cmdk, Kanban dnd-kit 6 columns, Agents grid chief bigger + drawer + [id] page, Live Ops LogViewer+Terminal+Dispatch+Approval, Analytics 8 charts, Audit immutable+CSV, Settings 8 tabs, backup VACUUM INTO daily 3AM retention 30d, logger JSON+global handlers, graceful shutdown 30s, build hijau 106s First Load 101kB, SSE 10/10

**Kategori di Ecosystem-Config:** `services/` (6 backend) — sebelumnya tertulis FastAPI/WebSocket P2, perlu update ke Next.js 16 / SQLite WAL / SSE

**Integrasi:**
- `niu-dash` inventory: 112 projects tracked → should be 113 with mission-control
- `Niu-OSS-Dashboard` aggregator: 90 repos → should be 91 with mission-control (auto via GitHub REST if public)
- `hermes-agent`: adapter HermesCLIAdapter + future HermesGatewayAdapter
- `ecosystem-config` registry: deployment-status, model-mapping, ai-ecosystem

**DOX:** `AGENTS.md` di root + `docs/dox/INDEX.md`

**Quick Links:**
- README: `README.md` + `apex-ui/README.md`
- PRD: `docs/PRD.md` v4.0 Aether 1863 baris
- Audit: `AUDIT_MISSION_CONTROL.md` 740 baris skor 6.2→8.5
- Sync Plan: `docs/SYNC_PLAN_V4_ECOSYSTEM_2026-09-26.md`
- API: `docs/API.md`
- Orchestration: `docs/ORCHESTRATION.md`

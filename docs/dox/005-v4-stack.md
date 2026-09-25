# ADR-005: v4.0 Stack — Next.js 15 + SQLite WAL + SSE + Zustand + Tailwind 4

**Status:** Accepted  
**Date:** 2026-09-24  
**Deciders:** Afrizal Munthe + Hermes Chief  
**Supersedes:** ADR-001 (vanilla HTML/CSS/JS)

## Context

v3.0 adalah UI showcase cantik (orb + reasoning web) tapi tidak punya backend, orchestration, realtime, observability, security yang layak. PRD v4.0 "Aether" menargetkan self-hosted AI agent control plane production-ready untuk solo operator dengan swarm 5 agent.

Pilihan stack harus:
- Single-node, zero external deps (tidak perlu Redis/Postgres/K8s untuk v4.0)
- Realtime (<100ms event delivery) dengan auto-reconnect replay
- Type-safe validation 100% input
- Visual signature tetap hidup (orb + reasoning web terhubung data nyata)
- Mudah deploy di macOS LaunchAgent dan Linux systemd + Docker
- Solo dev friendly (1-2 hari per milestone)

## Decision

**Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS 4 + Zustand + SWR + cmdk + dnd-kit + lucide-react + R3F Three.js (orb particle core, lazy)

**Backend:** Next.js Route Handlers (Node.js runtime, dynamic) + better-sqlite3 (synchronous, WAL mode) + Zod + iron-session + bcryptjs/scrypt native + EventBus in-process + SSE

**Realtime:** SSE default untuk dashboard feeds (auto-reconnect Last-Event-ID, proxy-friendly), bukan WebSocket untuk unidirectional feeds; WebSocket optional untuk bidirectional control channel (future)

**Database:** SQLite WAL mode, single file `data/swarm_state.db`, 11 tables (agents, tasks, events, dispatches, cost_tracking, artifacts, approvals, audit_log, system_logs, schedules, app_settings) + triggers, migrations runner, seed 5 agents

**State Client:** Zustand modular stores (agents, tasks, health, activity) + SWR untuk fetch, SSE update stores tanpa polling

**Validation:** Zod schemas single source of truth untuk semua POST/PATCH body + query (coerce)

**Auth:** Session cookie httpOnly sameSite strict secure prod + API key X-API-Key timing-safe + middleware protect /api/mc/* + /login /setup first-run generate hash+key+secret → .env.local

**Deployment:** Next.js standalone output (`output: 'standalone'`) → `server.js` + `.next/standalone/server.js`, Dockerfile multi-stage node:22-alpine (deps → builder → runner non-root nextjs user), docker-compose bind mount data, LaunchAgent plist KeepAlive, systemd unit Restart always + hardening

**Logging:** Structured JSON logger (prod JSON, dev pretty) + timestamp level module requestId taskId agentId metadata + write to system_logs DB (skip debug) + global handlers uncaughtException/unhandledRejection

**Backup:** VACUUM INTO daily 3AM + retention 30d + scheduler hourly check + manual trigger API + download with path traversal protection

## Rationale

1. **Builderz/mission-control reference** — mature, 6k+ stars, Next.js 16+React 19+TS+SQLite WAL+better-sqlite3+Tailwind+Zustand+Recharts+xterm.js, WebSocket+SSE+REST+MCP+CLI, RBAC, quality gates, Zod, session cookies+API keys+Google sign-in. Arsitektur Web UI/CLI/MCP → auth → dispatch/events/policy/receipts → SQLite + runtimes. Kita adaptasi dengan visual signature orb + reasoning web yang hidup (beda dari generic UI Builderz).

2. **SQLite WAL** — single-node control plane, 1-20 agents, zero external deps, performa sangat baik untuk single-writer, concurrent read aman, backup mudah (VACUUM INTO), digunakan Builderz dengan model sama. Tidak perlu Redis/Postgres untuk v4.0 (N4.5).

3. **SSE vs WebSocket** — Zylos.ai research: SSE default untuk dashboard feeds (auto-reconnect Last-Event-ID, proxy-friendly, HTTP plain, tidak perlu upgrade), WebSocket untuk bidirectional control channel. Dashboard kita mostly unidirectional (server→client events), jadi SSE lebih sederhana, tidak perlu ws package, bekerja di reverse proxy/Tailscale/Caddy. Fallback polling 10s jika SSE gagal.

4. **Zustand + SWR** — minimal, tidak ada boilerplate Redux, modular stores hindari re-render tidak perlu, SWR untuk fetch dengan cache, SSE update stores tanpa polling. Cocok untuk solo dev.

5. **Tailwind 4** — seperti Builderz, konsistensi dan kecepatan pengembangan, design tokens via @theme CSS variables, dark-first bukan black (#0a0f1a base), contrast 4.5:1, info density seperti Linear.app.

6. **Next.js standalone** — output standalone menghasilkan server.js minimal, mudah deploy Docker/self-hosted tanpa Vercel (Vercel tidak cocok untuk long-running worker loop — PRD R3). Worker loop berjalan di Node.js process Next.js server (bukan edge), interval 3 detik, tidak crash meskipun 100% task gagal.

7. **better-sqlite3 synchronous** — SQLite single-writer, async driver hanya overhead, Next.js Route Handlers di thread pool terpisah, blocking sync driver tidak block event loop utama jika dynamic + server runtime (bukan edge). Performa sangat baik untuk single-node.

8. **dnd-kit + cmdk** — dnd-kit untuk Kanban drag & drop (PointerSensor distance 5, closestCorners, sortable per kolom, droppable highlight), cmdk untuk Command Palette ⌘K (Quick Actions, Navigate, Recent Tasks, Agents, create inline).

9. **Structured logger** — ganti console.log dengan JSON logger, timestamp level module requestId, write to system_logs DB untuk observability di UI, uncaughtException & unhandledRejection tercatat.

10. **Backup VACUUM INTO** — SQLite 3.27+ feature, consistent snapshot tanpa lock manual, lebih aman daripada copy file saat WAL mode, retention 30d, scheduler daily 3AM.

## Consequences

- **Positif:** Single process, single file DB, mudah backup/restore, deploy satu perintah Docker atau LaunchAgent/systemd, realtime <100ms, type-safe 100%, visual tetap hidup, solo dev bisa 1-2 hari per milestone, M1-M7 minimum lovable product usable sehari-hari.
- **Negatif:** Tidak cocok untuk multi-machine atau 100+ agents (butuh Redis/Postgres/K8s di v5+), SQLite single-writer limit concurrency (tapi untuk 5 agents cukup), Next.js dev HMR perlu globalThis singleton untuk EventBus & Dispatcher survive reload (sudah diimplement).
- **Trade-offs:** Inline styles masih ada di komponen baru (seharusnya Tailwind/CSS modules dengan design tokens) — tapi komponen baru sudah konsisten dengan tokens via CSS variables, refactor full Tailwind bisa menyusul di M11 polish tanpa block v4.

## Alternatives Considered

- **Prisma/Drizzle ORM** — terlalu berat untuk single file, raw SQL cukup untuk v4 (N6.3 Zod single source of truth).
- **Postgres/Redis** — overkill untuk single-node 5 agents, tambah ops complexity, tidak perlu di v4.0 (N4.5).
- **WebSocket only** — lebih kompleks, perlu upgrade, tidak proxy-friendly, untuk dashboard feeds unidirectional SSE lebih sederhana.
- **Vercel deploy** — tidak cocok untuk long-running worker loop (R3), harus self-hosted Docker/LaunchAgent/systemd.
- **Electron/Tauri desktop app** — out of scope v4.0 (PRD §19.10), cukup responsive web.

## References

- Builderz/mission-control architecture
- Zylos.ai Real-Time Streaming Architectures for AI Agent Fleet Observability
- VDF.ai Enterprise AI Agent Platform Architecture Patterns 2026
- Linear.app information density & keyboard-first UX
- Flowmazeux SaaS Dashboard Design Best Practices 2026

# Docs Index — Niu-Mission-Control v4.0 Aether

**DOX Version:** 4.0  
**Peta folder resmi (Wajib patuh, jangan bikin folder baru di bawah docs/ tanpa izin — DOX v4.0 rule):**

```
docs/
├── dox/                  ← Project-specific DOX + ADR (Architecture Decision Records)
│   ├── INDEX.md          ← File ini — peta folder resmi
│   ├── 001-frontend-framework.md  ← ADR: vanilla vs Next.js (superseded by 005)
│   ├── 002-database.md            ← ADR: SQLite vs Postgres
│   ├── 003-monorepo.md            ← ADR: monorepo structure
│   ├── 004-apex-ui-adaptation.md  ← ADR: APEX-UI fork adaptation
│   ├── 005-v4-stack.md            ← ADR: Next.js 15+SQLite WAL+SSE+Zustand+Tailwind4 (current)
│   ├── 006-sse-realtime.md        ← ADR: SSE default vs WebSocket
│   └── 007-xterm-terminal.md      ← Future: xterm.js terminal attach
│
├── registry/             ← Registry hidup — auto-generated atau manual sync dari ecosystem-config
│   ├── project-catalog.md         ← Entry mission-control di ekosistem 40 repo
│   ├── deployment-status.md       ← Docker/LaunchAgent/systemd/Vercel status
│   ├── model-mapping.md           ← Adapter mapping: mock, hermes-cli, hermes-gateway + probe
│   ├── ai-ecosystem.md            ← AI ecosystem (hermes-agent, orchestrator, characters)
│   └── skill-registry.md          ← Pointer ke ~/Desktop/Niumination/docs/registry/skill-registry.md (121 skill)
│
├── reports/              ← Laporan, status, audit, sync-plan — timestamped
│   ├── ECOSYSTEM-AUDIT-2026-09-26.md
│   ├── ECOSYSTEM-STATUS-2026-09-26.md
│   └── SYNC-PLAN-2026-09-26.md (copy dari SYNC_PLAN_V4_ECOSYSTEM_2026-09-26.md)
│
├── references/           ← Studi, riset, referensi eksternal
│   ├── builderz-mission-control.md
│   ├── langgraph-vs-crewai.md
│   ├── saas-dashboard-ux.md
│   └── real-time-fleet-observability.md
│
├── API.md                ← 14 endpoints spec + event types + error format + security
├── ORCHESTRATION.md      ← 11 sections: state machine, dispatcher, adapters, approval, event bus, cost, backup, logging, shutdown, Docker, UI polish
├── PRD.md                ← v4.0 Aether 1863 baris final 24 Sep 2026
├── CHANGELOG.md          ← v4.0.0 + v4.1.0 target
├── STATUS.md             ← Status terkini (mungkin superseded by reports/)
├── assets/               ← Visual concepts, hero images, orb concepts
└── SYNC_PLAN_V4_ECOSYSTEM_2026-09-26.md ← Rencana sinkronisasi 6 fase (root docs, akan dipindah ke reports/)
```

**Aturan DOX v4.0:**
- Dilarang membuat folder baru di bawah `docs/` tanpa izin
- Dilarang menulis ke `docs/reference/` (singular) — sudah dihapus 16 Sep 2026, regresi pernah 2x
- Semua laporan/rencana → `docs/reports/`
- Registry hidup → `docs/registry/`
- Studi → `docs/references/`
- Docs adalah source of truth — setiap perubahan kode WAJIB DOX pass

**Legacy:**
- `docs/adr/` → pindah ke `docs/dox/` (sudah di-copy, adr/ akan di-archive)
- `docs/CUTOVER_CHECKLIST.md`, `LAUNCHAGENT_SETUP.md`, `PHASE5_PLAN.md`, `REDESIGN_PLAN.md`, etc → superseded, tandai di CHANGELOG, pindah ke `docs/reports/` atau archive

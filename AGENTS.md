# Niu-Mission-Control — DOX (Project-Specific)

**Lokasi:** `services/niu-mission-control/`  
**Repo:** `github.com/Niumination/niu-mission-control`  
**Stack:** Next.js 16 (target, saat ini 15.3.8) + React 19 + TypeScript 7 (target, saat ini 5) + SQLite WAL + better-sqlite3 + SSE + Zustand + SWR + Tailwind 4 + dnd-kit + cmdk + R3F  
**DOX Version:** 4.0 (inherit dari `~/Desktop/Niumination/AGENTS.md` root)  
**Versi Produk:** v4.0.0 Aether (current dev ready) → v4.1.0 Aether Sync (target sync ekosistem)  
**Pemilik:** Afrizal Munthe (Niumination) — Pranata Komputer Diskominfo Aceh Tengah  
**Total Projek Lokal:** ~43 git repos di `~/Desktop/Niumination/`  
**Kanban Board:** "Niumination Ecosystem" — terupdate 16 Jul 2026 ✅  
**Gold Standard Ref:** `Niu-OSS-Dashboard` (Next.js 16.3.5 + React 19.2.8 + TS 7 + PWA + i18n 474 keys + a11y WCAG 2.2 AA + API v1 107 endpoints)

---

## Skill Registry

> Daftar lengkap skill + trigger + level ada di `~/Desktop/Niumination/docs/registry/skill-registry.md` (auto-generated, 121 skill). Generator: `skills/sync-to-agents.sh` + `scripts/skill-manifest.py` (manifest SHA-256 + verifikasi). Jangan menyalin tabelnya ke sini.

Skill relevan untuk mission-control:
- `external-pr-audit` — audit PR dari luar ekosistem (arena.ai, designarena.ai) sebelum merge
- `secret-scan-staged` — scan rahasia di staged files via `.githooks/pre-commit`
- `model-mapping` — auto-discovery model mapping via probe HTTP-200
- `ecosystem-health` — cek health semua services (termasuk mission-control `/api/mc/health`)

---

## Global Agent Rules (inherit dari Root DOX v4.0)

- **Git discipline:** selective `git add` (never blind `git add .`); setiap commit menyertakan perubahan DOX; docs adalah source of truth
- **macOS services:** service launchd yang butuh jaringan WAJIB WaitNetwork (NetworkState key) sebelum start — lihat `deploy/com.niumination.missioncontrol.plist` (sudah ada `NetworkState true`)
- **Skill sync:** sinkronisasi skill bank HANYA lewat tool resmi (`scripts/skill-manifest.py` + `sync-to-agents.sh` + lockfile/hash). Dilarang copy-paste manual antar agent target (Hermes/USB)
- **Model mapping:** jangan pakai combo/generic model sebagai mapping utama thread/DM. Sumber mapping sah: hasil auto-discovery (lihat `docs/registry/model-mapping.md`) — fallback chain harus lolos probe HTTP-200 sebelum dicatat
- **UI/theme (semua proyek UI):** gunakan CSS theme tokens; dilarang hardcode overlay warna/transparansi yang menyimpang dari token proyek. Audit: `grep -r "bg-\[#"` di `components/`
- **One-home rule:** satu file hanya punya satu repo-home. Berbagi lintas repo hanya via pointer/symlink, bukan salinan yang di-track git. Contoh: `.env.example` root adalah source, `apex-ui/.env.example` adalah symlink atau generated via `scripts/sync-env.sh`
- **Kerja di luar ekosistem & gerbang adopsi:** pemilik juga bekerja di luar ekosistem ini (arena.ai, designarena.ai, sandbox lain) — itu disengaja, bukan drift. Hasil dari luar (PR/branch/zip/laporan, sering atas nama GitHub App pihak ketiga) masuk ekosistem hanya lewat konfirmasi pemilik; agent ekosistem berperan memeriksa lalu melaporkan, bukan mengeksekusi atau merge otomatis. Jangan memperlakukan pekerjaan luar sebagai pelanggaran, dan jangan mengubah sandbox luar dari sini tanpa izin. Prosedur: skill `external-pr-audit`
- **Struktur docs (WAJIB):** semua dokumen hanya di dalam `docs/`. Laporan, rencana, strategi, ide, dan prompt → `docs/reports/`. Registry hidup (skill-registry, project-catalog, deployment-status, ai-ecosystem, model-mapping) → `docs/registry/`. Arsip studi → `docs/references/`. Dilarang membuat folder baru di bawah `docs/` dan dilarang menulis ke `docs/reference/` (dihapus 16 Sep 2026 — regresi pernah terulang dua kali). Peta folder resmi: `docs/dox/INDEX.md`
- **Kredensial & `git add -f` (WAJIB):** dilarang meng-commit berkas yang di-ignore `.gitignore` (`.env`, `vault/`, `apps/**/.env`, `*.key`). `git add -f` adalah satu-satunya jalan berkas rahasia lolos ke history — insiden 16 Sep 2026 (`apps/pi-app-studio-mata/server/.env` berisi `PI_API_KEY` sampai masuk repo publik) lahir dari sana. Rahasia hanya di `~/.hermes/.env`, `vault/`, atau berkas git-ignored; repo hanya memuat contoh (`.env.example`). Gate otomatis: `scripts/secret-scan-staged.py` + `.githooks/pre-commit` — aktifkan per clone dengan `git config core.hooksPath .githooks`

---

## Project-Specific Rules — Niu-Mission-Control

### Lokasi & Struktur

```
services/niu-mission-control/
├── apex-ui/                  # Next.js app (main UI) — ini yang di-deploy
│   ├── app/
│   │   ├── (app)/            # Group terproteksi (AppShell + SSE)
│   │   │   ├── page.tsx      # Overview (orb + reasoning web)
│   │   │   ├── missions/     # Kanban 6 kolom dnd-kit
│   │   │   ├── agents/       # Grid + [id] detail
│   │   │   ├── live-ops/     # LogViewer + Terminal + Dispatch + Approval
│   │   │   ├── analytics/    # 8 charts custom SVG
│   │   │   ├── audit/        # Immutable + CSV
│   │   │   └── settings/     # 8 tabs + Backup manual trigger+download
│   │   ├── api/
│   │   │   ├── auth/         # login/logout/setup
│   │   │   └── mc/           # 14 endpoints (health, agents, tasks, etc)
│   │   ├── login/ + setup/   # Public routes
│   │   └── globals.css       # @theme tokens (slate navy bukan hitam murni)
│   ├── components/
│   │   ├── shell/            # AppShell 210↔64 + CommandPalette cmdk
│   │   ├── kanban/           # KanbanBoard + Card + Inspector + CreateModal
│   │   ├── agents/           # AgentCard + Detail
│   │   ├── live-ops/         # LogViewer + TerminalView + DispatchComposer + ApprovalQueue
│   │   ├── analytics/        # ChartComponents
│   │   └── ui/               # Toast + ErrorBoundary + Skeleton + EmptyState + Button etc
│   ├── lib/
│   │   ├── server/           # DB (better-sqlite3 WAL) + state-machine + dispatcher + adapters + events + auth + backup + logger + bootstrap
│   │   └── client/           # Zustand stores + SSE hook + transitions mirror
│   ├── migrations/           # 001_initial.sql (11 tables)
│   ├── scripts/              # test-sse.mjs 10 cases + backup.ts CLI
│   ├── deploy/               # Dockerfile multi-stage + compose + LaunchAgent plist + systemd + start.sh + README
│   ├── public/               # Static assets
│   │   └── manifest.json     # (TODO PWA)
│   ├── next.config.mjs       # standalone + serverExternalPackages better-sqlite3 (target next.config.ts di Next 16)
│   └── package.json          # next 15.3.8 → target 16.3.5
│
├── data/                     # SQLite DB + backups (gitignored, bind mount di Docker)
│   ├── swarm_state.db
│   └── backups/              # backup-YYYY-MM-DD-HHMMSS.db (VACUUM INTO, retention 30d)
│
├── docs/                     # WAJIB sesuai DOX v4.0
│   ├── dox/                  # ADR + INDEX.md peta folder resmi
│   ├── registry/             # project-catalog, deployment-status, model-mapping, skill-registry pointer
│   ├── reports/              # audit, status, sync-plan
│   ├── references/           # studi builderz, langgraph, saas ux
│   ├── API.md                # 14 endpoints spec
│   ├── ORCHESTRATION.md      # 11 sections
│   ├── PRD.md                # v4.0 Aether 1863 baris
│   └── CHANGELOG.md          # v4.0.0 + v4.1.0 target
│
├── .githooks/                # pre-commit secret-scan (TODO)
├── .env.example              # Source of truth env (MC_PASSWORD_HASH, MC_API_KEY, etc)
├── AGENTS.md                 # File ini — project DOX
└── com.niumination.missioncontrol.plist + com.niu.missioncontrol.plist (legacy)
```

### Aturan Kode

1. **DB path:** `MC_DB_PATH` env atau `path.resolve(process.cwd(), '..', 'data', 'swarm_state.db')` — dari `apex-ui/` cwd = repo root `/data`. Jangan pakai `../..` (bug lama yang sudah di-fix 24 Sep 2026)
2. **Migrations:** semua di `migrations/NNN_*.sql`, dijalankan via `runMigrations()` di `bootstrap.node.ts` sekali saat startup
3. **WAL + foreign_keys:** `journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL`, `busy_timeout=5000` — jangan diubah tanpa ADR
4. **State machine:** `VALID_TRANSITIONS` single source of truth di `lib/server/state-machine.ts` — jangan duplikat di route handlers, import dari sana
5. **API:** semua `/api/mc/*` harus `export const dynamic = 'force-dynamic'` + `withAuth` atau `publicHandler` + Zod `parseBody`/`parseQuery` + `ApiError`
6. **Auth:** scrypt hash native, session cookie httpOnly sameSite strict secure prod, API key timing-safe compare — jangan pakai bcryptjs untuk hash utama (sudah scrypt), bcryptjs hanya untuk legacy compat jika ada
7. **Dispatcher:** poll interval 3s, MAX_CONCURRENT 5, `claimAndDispatchOne` atomic, recovery stale running→queued saat startup, graceful shutdown 30s
8. **Events & SSE:** EventBus singleton via `globalThis` survive HMR, `useEventStream()` singleton guard ref di `(app)/layout.tsx` sekali, jangan mount per-page (cegah double-subscribe), Last-Event-ID replay
9. **Adapters:** interface `AgentAdapter` + `MockAdapter` + `HermesCLIAdapter` (execFile shell=false) + future `HermesGatewayAdapter` (HTTP) — registry `getAdapter/listAdapters/registerAdapter`
10. **Logger:** `lib/server/logger.ts` structured JSON di prod, pretty di dev, level dari `LOG_LEVEL` env, `registerGlobalErrorHandlers()` di `bootstrap.node.ts`
11. **Backup:** `VACUUM INTO` daily 3AM retention 30d via `startBackupScheduler()`, manual trigger POST `/api/mc/backups`, download GET `/api/mc/backups/:name` dengan filename regex + path traversal protection
12. **UI tokens:** `@theme` di `globals.css` — bg slate navy `#121212` bukan hitam murni, cyan/amber/emerald/red/violet/gold, radius, spacing, glow shadows, transitions — jangan hardcode `bg-[#...]` di components
13. **Build:** `npm run build` harus hijau, First Load JS ~101-110kB (jangan naik ke 965kB seperti OSS Dashboard), routes 200, SSE 10/10

### Env Vars

Lihat `.env.example` — source of truth:

```
MC_PASSWORD_HASH, MC_API_KEY, MC_SESSION_SECRET, MC_DB_PATH, HERMES_PATH/HERMES_CLI,
TELEGRAM_CHAT_ID, HOSTNAME 0.0.0.0 PORT 3000 LOG_LEVEL info DAILY_BUDGET_USD MONTHLY_BUDGET_USD,
BUDGET_ENFORCEMENT soft/hard
```

Jangan commit `.env.local` — itu gitignored, berisi secrets real.

### Testing

- Saat ini: `scripts/test-sse.mjs` 10 cases (auth, snapshot, dispatch lifecycle, multi-tab, Last-Event-ID replay) + manual `npm run build` + curl routes
- Target (gold standard OSS Dashboard): vitest 62/62 + Playwright E2E hidrasi 12/12 + axe-core a11y 13/13 + Lighthouse budget
- CI: `.github/workflows/ci.yml` harus tsc 0 + vitest + build + E2E + a11y (lihat SYNC_PLAN)

### Deployment

- **Docker:** multi-stage `deps→builder→runner` node:22-alpine, non-root nextjs, `data/` volume bind `../data:/app/data`, healthcheck wget `/api/mc/health`
- **LaunchAgent:** `com.niumination.missioncontrol.plist` Label com.niumination.missioncontrol, RunAtLoad true, KeepAlive Crashed + NetworkState true, logs `/opt/...`, NetworkState WAJIB (DOX rule)
- **systemd:** `niumination-missioncontrol.service` Restart always, hardening NoNewPrivileges PrivateTmp ProtectSystem full, ReadWritePaths data logs backups
- **start.sh:** load `.env.local`, mkdir backups logs, check build, prefer `server.js` then `.next/standalone/server.js` then `npm start`
- **Vercel:** optional landing only, mission-control self-hosted (bukan Vercel) karena SQLite + better-sqlite3 native

---

## Core Contract

1. File **AGENTS.md** ini adalah DOX binding work contract untuk subtree `services/niu-mission-control/`
2. Setiap perubahan kode WAJIB diikuti DOX pass sebelum task ditutup (update docs/ + AGENTS.md jika perlu)
3. Parent DOX adalah `~/Desktop/Niumination/AGENTS.md` root — jika konflik, doc yang lebih dekat ke file yang disentuh menang
4. Pindah fokus antar proyek: baca root AGENTS.md → navigasi ke proyek target → baca AGENTS.md anak jika ada
5. Jika ada konflik antar DOX, doc yang lebih dekat ke file yang disentuh menang

---

## Read Before Editing

1. Baca root `~/Desktop/Niumination/AGENTS.md` untuk orientasi ekosistem
2. Baca file ini (`services/niu-mission-control/AGENTS.md`) untuk rules spesifik
3. Identifikasi file yang akan disentuh — cek apakah ada DOX lebih dekat (misal `apex-ui/app/(app)/missions/AGENTS.md` jika ada)
4. Cek `docs/dox/INDEX.md` peta folder resmi — jangan bikin folder baru di bawah `docs/` tanpa izin
5. Cek `docs/registry/model-mapping.md` untuk adapter/model mapping yang sah
6. Selalu `git config core.hooksPath .githooks` sebelum commit pertama di clone baru
7. Selalu selective `git add <file>` — jangan `git add .`
8. Selalu `npm run build` + `MC_PASSWORD=apex node scripts/test-sse.mjs` sebelum commit

---

## Quick Links

- **Ecosystem Config:** `github.com/Niumination/ecosystem-config` — master orchestrator v4.0
- **Niu-OSS-Dashboard:** `github.com/Niumination/Niu-OSS-Dashboard` — gold standard Next.js 16 + PWA + i18n + a11y, live `niumination.web.id`
- **niu-dash:** `github.com/Niumination/niu-dash` — inventory dashboard 112 projects tracked
- **hermes-agent:** `github.com/Niumination/hermes-agent` — fork NousResearch, gateway + skills
- **sapa-ai:** `github.com/Niumination/sapa-ai` — Next.js + vitest + vercel + AGENTS.md + docs/serah-terima (pattern untuk kita)
- **PRD v4.0:** `docs/PRD.md` — 1863 baris final 24 Sep 2026
- **Audit:** `AUDIT_MISSION_CONTROL.md` — 740 baris skor 6.2/10 → 8.5/10 setelah v4.0 Aether
- **Sync Plan:** `docs/SYNC_PLAN_V4_ECOSYSTEM_2026-09-26.md` — rencana 6 fase sinkronisasi dengan ekosistem terkini
- **API Docs:** `docs/API.md` — 14 endpoints
- **Orchestration:** `docs/ORCHESTRATION.md` — 11 sections

---

**Status:** v4.0.0 Aether dev ready, build hijau 106s, SSE 10/10, routes 200, First Load 101kB  
**Next:** v4.1.0 Aether Sync — DOX compliance + Next 16 + vitest + a11y + i18n + PWA + registry sync

*Updated: 26 Sep 2026, Banda Aceh — Afrizal Munthe + Hermes Chief*

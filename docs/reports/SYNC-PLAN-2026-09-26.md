# Rencana Sinkronisasi v4.0 Aether dengan Ekosistem Niumination Terkini

**Tanggal:** 26 September 2026  
**Auditor:** Senior Dev / IT Architect / Orchestrator  
**Baseline Lokal:** `niu-mission-control` v4.0.0 Aether (Next.js 15.3.8, apex-ui, 14 endpoints, WAL+SSE+Zustand) — build hijau 106s, SSE 10/10  
**Baseline Remote GitHub:** `github.com/niumination` — 40+ repo, master orchestrator `ecosystem-config` v4.0, gold standard `Niu-OSS-Dashboard` Next.js 16.3.5 + React 19.2.8 + TS 7  
**Status:** `ecosystem-config` updated 20 menit lalu, `Niu-OSS-Dashboard` updated 3 menit lalu (98 commits, live `niumination.web.id`), `niu-mission-control` remote masih v3.0.0 package.json lawas + docs PRD v4.0 baru ditambah kemarin  
**Tujuan:** Sinkronkan `niu-mission-control` agar menjadi warga ekosistem kelas satu — bukan lagi showcase cantik yang terisolasi, tapi control plane yang patuh DOX v4.0, stack Next.js 16, i18n, PWA, a11y, API v1, vitest, dan terintegrasi dengan dashboard OSS.

---

## 1. Ringkasan Eksekutif — Apa yang Berubah di Ekosistem?

### 1.1 `ecosystem-config` — Master Orchestrator v4.0 (27 Agu 2026)

Ini repo index paling penting. Isinya bukan kode, tapi **kontrak kerja**:

```
Niumination/
├── AGENTS.md          ← DOX master — 285 baris, 20.5 KB, binding work contract
├── BACKLOG.md         ← Portfolio master
├── README.md          ← Index 40 repo ~18GB
├── apps/              13 PRODUCTION (PemdiAcehTengah, niu-dash, kune-ya, dll)
├── services/          6 BACKEND (cc-acehtengah, niu-mission-control, niu-cast, niu-flow, latticesend)
├── sites/             5 FRONTEND (niu-dash-fullstack Next.js 16, tedeo-kanban, audit-ti-at, spatial-vision)
├── desktop/           4 NATIVE (flame-ade Tauri 2, didong-code Electron, x-downloader)
├── agents/            4 AI (profile, orchestrator, ultra, characters/ 6 herdr agents)
├── docs/              WAJIB: reference/, reports/, notebooklm/, dox/ — DILARANG bikin folder baru di bawah docs/
├── scripts/           21 automation — skill-manifest.py + sync-to-agents.sh + secret-scan-staged.py
└── .githooks/         pre-commit hook aktif via `git config core.hooksPath .githooks`
```

**Aturan keras DOX v4.0 yang harus kita patuhi:**

- **Git discipline:** selective `git add` (never `git add .`), setiap commit sertakan DOX pass
- **One-home rule:** satu file hanya punya satu repo-home. Berbagi lintas repo hanya via pointer/symlink, bukan salinan track git
- **Skill sync:** HANYA via `skill-manifest.py` + `sync-to-agents.sh` + lockfile/hash. Dilarang copy-paste manual antar agent target
- **Model mapping:** jangan pakai combo/generic. Sumber sah: auto-discovery probe HTTP-200 → `docs/registry/model-mapping.md`
- **UI/theme:** gunakan CSS theme tokens; dilarang hardcode overlay warna/transparansi menyimpang dari token proyek
- **Docs structure WAJIB:** semua dokumen hanya di `docs/`. Laporan/rencana → `docs/reports/`. Registry hidup (skill-registry, project-catalog, deployment-status, ai-ecosystem, model-mapping) → `docs/registry/`. Studi → `docs/references/`. Dilarang `docs/reference/` (sudah dihapus 16 Sep 2026 karena regresi)
- **Kredensial & `git add -f`:** DILARANG commit `.env`, `vault/`, `apps/**/.env`, `*.key`. `git add -f` satu-satunya jalan rahasia lolos ke history — insiden 16 Sep 2026 `PI_API_KEY` masuk repo publik. Rahasia hanya di `~/.hermes/.env`, `vault/`, gitignored; repo hanya `.env.example`. Gate: `scripts/secret-scan-staged.py` + `.githooks/pre-commit`
- **macOS services:** service launchd WAJIB `NetworkState` WaitNetwork sebelum start
- **Kerja di luar ekosistem:** arena.ai, designarena.ai adalah sandbox disengaja. Hasil luar masuk ekosistem HANYA lewat konfirmasi pemilik, via skill `external-pr-audit`. Agent ekosistem memeriksa lalu melaporkan, bukan eksekusi/merge otomatis.

**Implikasi untuk mission-control:** Kita belum punya `.githooks/`, `AGENTS.md` di root repo, `docs/registry/`, secret-scan. Ini harus ditambah.

### 1.2 `Niu-OSS-Dashboard` — Gold Standard Baru (Next.js 16)

Repo ini **baru jadi acuan kualitas tertinggi** di ekosistem:

- **Stack:** Next.js 16.3.5 · React 19.2.8 · TS 7 · Vitest 5 · Tailwind · Framer Motion · cmdk · next/og · qrcode · React Three Fiber
- **Fitur:** Landing + dashboard agregator 90 repo publik, API publik v1 (107 endpoint), PWA offline, i18n id/en penuh 474 kunci parity, a11y WCAG 2.2 AA via axe-core+Playwright, SEO BreadcrumbList + avatar next/image, CSP report-only + SoftwareSourceCode, bundle audit
- **Quality gates:** `tsc 0`, `vitest 62/62`, `build 214/214` halaman, E2E hidrasi 12/12, a11y 13/13 lolos 0 pelanggaran dua bahasa, Lighthouse budget, dependabot, ISR force-cache, TimeAgo aman-hidrasi
- **Deploy:** Vercel, domain `niumination.web.id` (idwebhost NS → Vercel DNS), live 21 Sep 2026, uptime monitoring `chore(uptime): periksa berkala [skip ci]`
- **Docs:** 492 baris README, CHANGELOG fase Rilis awal → Produksi 2026.6, AGENTS.md runbook 62 tests, 214 pages

**Pelajaran untuk mission-control:**
- Kita masih Next.js 15.3.8, harus naik ke 16.3.x
- Kita belum punya i18n, PWA, a11y CI, API v1 versioning, vitest, Playwright
- Bundle kita 101kB First Load (bagus) vs mereka 965KB initial (trend naik, mereka catat sebagai temuan) — kita masih unggul di perf, harus jaga
- Mereka punya TitleSync (document.title ikut locale di 13 rute), ErrorBoundary sadar-locale, Skeletons aria — kita baru punya ErrorBoundary basic + Skeleton shimmer

### 1.3 `niu-mission-control` Remote vs Lokal

| Aspek | Remote GitHub (main) | Lokal Workspace (v4.0 Aether) | Gap |
|---|---|---|---|
| package.json | next 15.3.8 + react 19 + lucide + three + fiber + postprocessing saja (31 baris, v3.0.0) | next 15.3.8 + zustand + better-sqlite3 + zod + dnd-kit + cmdk + bcryptjs + iron-session + swr (full) | Remote ketinggalan 3 bulan, belum ada deps backend |
| Docs PRD v4.0 | Ada! `docs/PRD.md` 1863 baris final 24 Sep 2026 + `AUDIT_MISSION_CONTROL.md` 740 baris skor 6.2/10 | Kita sudah implement M1-M11 sesuai PRD | Remote baru tambah paket mc-v4 ke repo, kode belum sync |
| ROOT_DIR bug | Fix kemarin `path.resolve(process.cwd(), '..', '..')` → `'..'` agar DB connected | Lokal sudah benar `'..'` → `data/swarm_state.db` | Sudah sync, tapi perlu validasi di Docker/standalone |
| API routes | 7 route lama (system, agents, tasks, logs, cost, etc) masih pakai `execSync python3 db_manager.py` (antipattern) | 14 endpoints baru tanpa execSync, Zod 100%, timing-safe, httpOnly cookie | Remote perlu hapus legacy |
| DB | `data/` + `db_manager.py` 9144 baris (Python) | `better-sqlite3` WAL + migrations `001_initial.sql` + seed 5 agents + triggers | Remote perlu migrasi |
| Deploy | `com.niumination.missioncontrol.plist` port 5200 next start langsung | `deploy/` multi-stage Dockerfile + compose + LaunchAgent plist port 3000 + systemd + start.sh + backup | Remote perlu update |
| Testing | Hanya CI build/lint/typecheck | `scripts/test-sse.mjs` 10 cases + manual build verify | Belum ada vitest/Playwright |
| AGENTS.md | Tidak ada di root | Tidak ada | WAJIB tambah per DOX v4.0 |
| .githooks | Tidak ada | Tidak ada | WAJIB tambah secret-scan |

**Kesimpulan:** Lokal kita **lebih maju** dari remote (sudah v4.0 Aether), tapi **belum patuh DOX v4.0** dan **belum naik ke Next.js 16 gold standard**. Remote baru mulai adopt PRD v4.0 sebagai docs, belum kode.

### 1.4 Repo Lain yang Relevan

- **sapa-ai:** Next.js + `.nvmrc` + `vitest.config.ts` + `vercel.json` + `eslint.config.mjs` + `.githooks/` + `AGENTS.md` + `CHANGELOG.md` + `docs/serah-terima/` (berita acara, arsitektur, runbook, API, keamanan, tata kelola AI, pengujian, pemeliharaan). Pola ini harus kita tiru.
- **niu-dash:** Vanilla JS tapi v2.17.0, 112 projects tracked, PWA manifest + sw.js + hooks, data regeneration `chore(data): regenerate ecosystem-status`. Menjadi inventory dashboard — mission-control harus terdaftar di sini sebagai service.
- **hermes-agent:** Fork NousResearch/hermes-agent 25k commits, punya gateway, skills, providers, optional-mcps, acp_adapter, tui_gateway. `HermesCLIAdapter` kita harus selaras dengan CLI asli `hermes_cli/`.
- **Flame-ADE:** Tauri 2 + Rust + React 19, BYOK AI, no telemetry, OS keychain — pola security yang bisa kita adopsi (keychain vs .env).

---

## 2. Gap Analysis — Apa yang Kurang di Lokal v4.0 Aether?

### 2.1 Stack & Tooling Gap

| Area | Saat Ini (Lokal) | Gold Standard (Niu-OSS-Dashboard) | Action |
|---|---|---|---|
| Next.js | 15.3.8 | 16.3.5 | Upgrade 15→16, cek breaking: `next.config.ts` (bukan mjs), async `params` di `[id]` routes, `fetch` cache default |
| React | 19.0.0 | 19.2.8 | Minor bump |
| TypeScript | 5.x | 7.x | TS 7 butuh `@types` update, cek `tsconfig.json` `moduleResolution: bundler` |
| Tailwind | 4.3.3 + `@tailwindcss/postcss` | 4.x | Sudah sama, tapi perlu audit token vs DOX |
| Testing | `scripts/test-sse.mjs` manual 10 cases | Vitest 62/62 + Playwright E2E 12/12 + axe-core a11y 13/13 | Tambah vitest + Playwright + a11y.mjs |
| Lint | `next lint` | `eslint.config.mjs` flat config + `axe-core` di CI | Migrasi eslint flat + tambah a11y |
| PWA | Tidak ada | `public/sw.js` + manifest + offline cache list | Tambah PWA minimal (offline fallback untuk dashboard) |
| i18n | Tidak ada (hardcode ID) | 474 kunci id/en parity, TitleSync, locale-aware ErrorBoundary | Tambah i18n minimal (next-intl atau custom dict seperti OSS Dashboard) |
| API versioning | `/api/mc/*` | `/api/v1/*` 107 endpoint + `/api/pay/config` | Pertimbangkan alias `/api/v1/mc/*` sambil keep `/api/mc/*` backward compat |
| CI | `.github/workflows` lama (Python tests) | `ci.yml` dengan tsc + vitest + build + E2E hidrasi + a11y + Lighthouse budget + dependabot | Rewrite CI |
| Node version | Tidak ada `.nvmrc` | `.nvmrc` 22 | Tambah `.nvmrc` 22 |

### 2.2 DOX v4.0 Compliance Gap

| Aturan DOX | Status Lokal | Fix |
|---|---|---|
| `AGENTS.md` di root | ❌ Tidak ada | Buat `AGENTS.md` khusus mission-control, inherit dari root DOX |
| `docs/` structure | Partial: ada `adr/`, `assets/`, `API.md`, `ORCHESTRATION.md`, dll tapi tidak ada `registry/`, `reports/`, `references/`, `dox/` | Reorg: `docs/adr/` → `docs/dox/`, tambah `docs/registry/` (project-catalog, deployment-status, model-mapping), `docs/reports/` (audit, status) |
| `.githooks/` + secret-scan | ❌ Tidak ada | Copy dari `sapa-ai` / `ecosystem-config`: `scripts/secret-scan-staged.py` + `.githooks/pre-commit` + `git config core.hooksPath .githooks` |
| One-home rule | ⚠️ Ada duplikasi `apex-ui/.env.example` + root `.env.example` (copy) | Jadikan symlink atau single source + pointer docs |
| Selective git add | Unknown (kita di arena.ai sandbox) | Dokumentasikan di AGENTS.md, jangan `git add .` di Hermes |
| Skill sync | Tidak ada skill registry | Daftar di `ecosystem-config` docs/registry/skill-registry.md (121 skill) — mission-control perlu daftarkan skill baru jika ada |
| Model mapping | Hardcode model di `agents` table | Tambah `docs/registry/model-mapping.md` + auto-discovery probe (seperti di AGENTS.md global) |
| Theme tokens | Sudah pakai `@theme` di globals.css, tapi ada hardcode di beberapa component? | Audit: grep `bg-[#`, `text-[#`, `rgba(`, `#[0-9a-f]{6}` di components/ — ganti dengan token |
| `vault/` | Tidak ada | Buat `.gitignore` sudah ignore `vault/` + `data/` + `.env.local`, tapi belum ada folder vault contoh |

### 2.3 Arsitektur & Fitur Gap

| Area | Lokal v4.0 | Ekosistem Terkini | Rekomendasi |
|---|---|---|---|
| Dispatcher | Poll 3s, MAX_CONCURRENT 5, recovery stale running→queued | Di `ecosystem-config` ada 21 automation scripts + `brain/` Obsidian vault — belum ada integrasi dengan mission-control | Tambah `scripts/ecosystem-health.mjs` yang cek dispatcher health + push ke `niu-dash` data |
| Hermes adapter | `HermesCLIAdapter` execFile shell=false, parse stdout token usage | `hermes-agent` punya gateway + acp_adapter + providers | Validasi CLI path + tambah adapter `HermesGatewayAdapter` (HTTP) sebagai alternatif CLI, fallback chain |
| Cost tracking | `cost_tracking` table + metrics API | Di OSS Dashboard ada monetisasi Midtrans/Stripe + booking jasa | Untuk mission-control, cost tracking sudah bagus, tapi perlu budget hard kill-switch (stop dispatcher jika daily>budget) — ini TODO di M11 |
| RBAC | Single operator (session cookie) | Builderz/mission-control RBAC viewer/operator/admin + Google sign-in | Tambah RBAC minimal: `role` di `agents`? Atau `app_settings` role map — tapi untuk personal AI OS, single operator cukup, tapi siapkan schema `users` + `roles` untuk masa depan |
| Terminal | `TerminalView` read-only div styled | `Niu-OSS-Dashboard` tidak punya terminal, tapi `Flame-ADE` punya Tauri terminal + xterm.js | Future: xterm.js attach (sudah di M11 optional) — buat ADR 007 |
| Analytics | 8 charts custom SVG | OSS Dashboard pakai Recharts? Atau custom? | Kita sudah custom SVG (lebih ringan), tapi pertimbangkan Recharts untuk konsistensi ekosistem |
| Backup | VACUUM INTO daily 3AM retention 30d + manual trigger + download | Di `ecosystem-config` ada `archive/backup/` + `scripts/` backup | Sync: backup dir `data/backups/` sudah benar, tapi tambah symlink ke `archive/backup/`? Atau script `scripts/backup-to-archive.sh` |
| Deployment | Docker multi-stage + compose + LaunchAgent + systemd + start.sh | `PemdiAcehTengah` deploy Vercel, `niu-dash` GH Pages, `Niu-OSS-Dashboard` Vercel + domain .web.id | Mission-control self-hosted (bukan Vercel) — sudah benar Docker, tapi tambah opsi Vercel untuk landing? Atau tetap self-hosted, tapi docs deployment di `ecosystem-config` perlu update |

---

## 3. Prinsip Sinkronisasi — Bagaimana Kita Menyatukan?

### 3.1 Filosofi

> "Satu file, satu rumah. Satu ekosistem, satu DOX."

- **Jangan rewrite ulang v4.0 Aether** — itu sudah 106s build hijau, 14 endpoints, SSE 10/10. Yang kita lakukan adalah **upgrade & patuh DOX**, bukan rebuild.
- **Ikuti gold standard Niu-OSS-Dashboard** untuk tooling (Next 16, TS 7, vitest, a11y, PWA, i18n) tapi **jaga keunggulan perf** kita (101kB First Load vs 965KB mereka).
- **DOX adalah source of truth** — setiap perubahan kode WAJIB DOX pass (update `AGENTS.md` + `docs/`).
- **Selective sync:** Kita tidak perlu jadi clone OSS Dashboard. Mission-control adalah **control plane**, bukan landing aggregator. Ambil yang relevan: Next 16, TS 7, vitest, a11y, PWA minimal, i18n minimal, `.githooks`, `AGENTS.md`, `docs/` reorg, `.nvmrc`, CI.

### 3.2 Urutan Sinkronisasi (Dependency Order)

1. **DOX compliance dulu** (AGENTS.md, .githooks, docs reorg) — ini gate untuk semua commit selanjutnya
2. **Tooling upgrade** (Next 16, TS 7, .nvmrc, eslint flat, tailwind audit) — breaking changes harus di awal
3. **Testing & a11y** (vitest, Playwright, axe-core) — jadi safety net untuk refactor selanjutnya
4. **Fitur ekosistem** (i18n, PWA, API v1 alias, budget kill-switch, RBAC schema) — value add
5. **Integrasi** (niu-dash inventory, Niu-OSS-Dashboard API, hermes-agent gateway, ecosystem-config registry) — sinkron antar repo
6. **Deploy & docs** (Docker, LaunchAgent, systemd, Vercel landing, README final, CHANGELOG) — polish akhir

---

## 4. Rencana Perbaikan Bertahap — 6 Fase

### FASE 0: Audit & Gate (1-2 hari) — SELESAI 80% (dokumen ini)

**Tujuan:** Punya peta lengkap gap + gate DOX.

**Tasks:**

- [x] Audit `github.com/niumination` (40+ repo, 18GB)
- [x] Audit `ecosystem-config` AGENTS.md 285 baris DOX v4.0
- [x] Audit `Niu-OSS-Dashboard` gold standard Next 16 + 107 API + PWA + i18n 474 keys + a11y
- [x] Audit `niu-mission-control` remote vs lokal (package.json lawas vs v4.0 Aether)
- [x] Audit `sapa-ai`, `niu-dash`, `hermes-agent` patterns
- [ ] Buat `docs/reports/ECOSYSTEM-AUDIT-2026-09-26.md` (ringkasan temuan ini, 1 halaman)
- [ ] Buat `docs/registry/project-catalog.md` entry untuk mission-control (update dari `ecosystem-config` README yang masih tulis FastAPI)

**Acceptance:** Dokumen SYNC_PLAN ini + audit report di `docs/reports/`.

**File yang disentuh:**
- `docs/SYNC_PLAN_V4_ECOSYSTEM_2026-09-26.md` (ini)
- `docs/reports/ECOSYSTEM-AUDIT-2026-09-26.md` (baru)

---

### FASE 1: DOX Compliance — WAJIB SEBELUM KODE (2-3 hari)

**Tujuan:** Patuh `ecosystem-config` DOX v4.0, jadi warga ekosistem resmi.

**Tasks:**

1. **Buat `AGENTS.md` di root `niu-mission-control/`** (bukan di `apex-ui/`):
   - Inherit dari `~/Desktop/Niumination/AGENTS.md` (root DOX)
   - Isi: Project-specific DOX — lokasi `apex-ui/`, `data/`, `docs/`, `deploy/`, aturan selective git add, one-home rule, theme tokens, model mapping, skill sync
   - Contoh struktur (mirip `sapa-ai/AGENTS.md`):
     ```
     # Niu-Mission-Control — DOX
     Lokasi: services/niu-mission-control/
     Stack: Next.js 16 + SQLite WAL + SSE + Zustand + Tailwind 4
     DOX Version: 4.0
     ...
     ## Project Rules
     - DB path: MC_DB_PATH || ../data/swarm_state.db
     - API: /api/mc/* (legacy) + /api/v1/mc/* (new)
     - Auth: scrypt + iron-session httpOnly
     - Dispatcher: poll 3s MAX_CONCURRENT 5
     - Backup: VACUUM INTO daily 3AM retention 30d
     ```

2. **Tambah `.githooks/` + secret-scan:**
   - Copy `scripts/secret-scan-staged.py` dari `ecosystem-config` atau `sapa-ai`
   - Buat `.githooks/pre-commit`:
     ```bash
     #!/bin/sh
     python3 scripts/secret-scan-staged.py
     ```
   - `chmod +x .githooks/pre-commit`
   - Instruksi di `AGENTS.md`: `git config core.hooksPath .githooks`
   - Tambah `.gitleaks.toml` jika belum ada

3. **Reorg `docs/` sesuai DOX:**
   - Saat ini: `API.md`, `CHANGELOG.md`, `CUTOVER_CHECKLIST.md`, `LAUNCHAGENT_SETUP.md`, `ORCHESTRATION.md`, `PHASE5_PLAN.md`, `PRD.md`, `REDESIGN_PLAN.md`, `adr/`, `assets/`
   - Target DOX:
     ```
     docs/
     ├── dox/
     │   ├── INDEX.md (peta folder resmi)
     │   ├── AGENTS.md (copy/link ke root AGENTS.md)
     │   ├── 001-frontend-framework.md (dari adr/)
     │   ├── 002-database.md
     │   ├── 003-monorepo.md
     │   ├── 004-apex-ui-adaptation.md
     │   ├── 005-v4-stack.md
     │   ├── 006-sse-realtime.md
     │   └── 007-xterm-terminal.md (future)
     ├── registry/
     │   ├── project-catalog.md (entry mission-control)
     │   ├── deployment-status.md (Docker/LaunchAgent/systemd/Vercel)
     │   ├── model-mapping.md (hermes, mock, gateway adapters)
     │   └── skill-registry.md (pointer ke ecosystem-config)
     ├── reports/
     │   ├── ECOSYSTEM-AUDIT-2026-09-26.md
     │   ├── ECOSYSTEM-STATUS-2026-09-26.md
     │   └── SYNC-PLAN-2026-09-26.md (copy dari root docs/)
     ├── references/
     │   ├── builderz-mission-control.md
     │   ├── langgraph-vs-crewai.md
     │   └── saas-dashboard-ux.md
     ├── API.md (tetap, tapi tambah versi v1)
     ├── CHANGELOG.md
     ├── ORCHESTRATION.md
     ├── PRD.md
     └── assets/ (visual concepts)
     ```
   - Jangan buat `docs/reference/` (singular) — itu regresi yang pernah 2x terjadi.

4. **One-home rule fix:**
   - `apex-ui/.env.example` + root `.env.example` duplikat → jadikan root `.env.example` sebagai source, `apex-ui/.env.example` symlink atau `cat ../.env.example > apex-ui/.env.example` di `scripts/sync-env.sh`
   - Tambah `scripts/sync-env.sh`

5. **Tambah `.nvmrc` + `vault/` gitignore:**
   - `.nvmrc` isi `22`
   - Pastikan `.gitignore` sudah ignore `vault/`, `data/*.db`, `data/*.db-wal`, `data/*.db-shm`, `.env.local`, `apex-ui/.env.local`, `*.key`, `*.pem`

**Acceptance:**
- `AGENTS.md` ada di root, 100+ baris, patuh DOX v4.0
- `.githooks/pre-commit` aktif, `git config core.hooksPath .githooks` di README
- `docs/dox/INDEX.md` peta folder resmi
- `docs/registry/` ada 3 file minimal
- `npm run build` masih hijau setelah reorg (docs tidak affect build)

**Estimasi:** 2-3 hari solo dev part-time.

---

### FASE 2: Stack Upgrade — Next.js 15 → 16 Gold Standard (3-5 hari)

**Tujuan:** Naik ke Next.js 16.3.5 + React 19.2.8 + TS 7 + Tailwind 4 + eslint flat, seperti Niu-OSS-Dashboard.

**Tasks:**

1. **Next.js 15.3.8 → 16.3.5:**
   - `npm install next@16.3.5 react@19.2.8 react-dom@19.2.8 eslint-config-next@16.3.5`
   - Breaking changes Next 16:
     - `next.config.mjs` → `next.config.ts` (atau tetap mjs tapi dengan `/** @type {import('next').NextConfig} */`)
     - `params` di `app/api/mc/agents/[id]/route.ts`, `tasks/[id]`, `backups/[name]` sekarang `Promise<{id: string}>` — harus `await params`
     - `fetch` cache default berubah (di OSS Dashboard mereka pakai `force-cache` untuk ISR) — kita pakai `dynamic` routes jadi aman, tapi cek `app/api/mc/*` yang `export const dynamic = 'force-dynamic'`
     - `instrumentation.ts` mungkin perlu update (kita sudah punya untuk logger)
   - Test: `npm run build` → 214 pages? Kita target tetap ~12 routes, tapi build harus hijau.

2. **TypeScript 5 → 7:**
   - `npm install -D typescript@7 @types/node@22 @types/react@19 @types/react-dom@19 @types/three@0.184.1 @types/better-sqlite3@9 @types/bcryptjs@2`
   - `tsconfig.json` update: `moduleResolution: bundler`, `target: ES2022`, `lib: ES2022,DOM`, `strict: true` sudah ada
   - `tsc --noEmit` harus 0 error (seperti OSS Dashboard `tsc 0`)

3. **Tailwind 4.3.3 audit:**
   - Sudah 4.3.3, tapi cek `@theme` di `globals.css` — apakah token kita clash dengan OSS Dashboard `ink/cream/ember + spotlight cyan`?
   - Kita punya `bg slate navy bukan hitam murni` — ini sudah benar (dark-mode tidak boleh pure black #121212 base, kontras 4.5:1)
   - Audit hardcode: `grep -r "bg-\[#" apex-ui/components/ --include="*.tsx" | head -20` — ganti dengan token

4. **ESLint flat config:**
   - Dari `eslint.config.mjs` legacy → flat config seperti `sapa-ai`:
     ```js
     import next from 'eslint-config-next'
     export default next
     ```
   - Atau copy dari `Niu-OSS-Dashboard/eslint.config.mjs`
   - Tambah rule `react-hooks/exhaustive-deps` warning → error? Di build kita ada 5 warnings (agents/[id], audit, live-ops, ReasoningWeb) — fix dengan `useCallback` atau `// eslint-disable-next-line`

5. **`.nvmrc` + `packageManager`:**
   - `.nvmrc` `22`
   - `package.json` tambah `"packageManager": "npm@10.x"` atau `"pnpm"`? OSS Dashboard pakai npm, kita ikut npm.

**Acceptance:**
- `npm run build` hijau di Next 16, First Load JS tetap ~101-110kB (jangan naik ke 965kB seperti OSS Dashboard)
- `tsc --noEmit` 0 error
- `npm run lint` 0 error (atau warnings yang sudah di-fix)
- Semua 7 pages 200 OK, SSE 10/10 masih lulus

**Estimasi:** 3-5 hari, paling berisiko (breaking changes).

---

### FASE 3: Testing & A11y — Safety Net (3-4 hari)

**Tujuan:** Punya vitest + Playwright + axe-core seperti gold standard, jadi refactor selanjutnya aman.

**Tasks:**

1. **Vitest:**
   - `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
   - `vitest.config.ts` (copy dari `sapa-ai` atau `Niu-OSS-Dashboard`):
     ```ts
     import { defineConfig } from 'vitest/config'
     export default defineConfig({
       test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] }
     })
     ```
   - Target 20-30 tests awal (OSS Dashboard 62):
     - `lib/server/state-machine.test.ts` — VALID_TRANSITIONS, canTransition, calculateBackoffMs
     - `lib/server/schema.test.ts` — Zod schemas valid/invalid
     - `lib/server/auth.test.ts` — timing-safe compare, scrypt
     - `lib/server/backup.test.ts` — filename validation, path traversal
     - `components/ui/Toast.test.tsx` — toast render
     - `components/kanban/KanbanBoard.test.tsx` — DND basic

2. **Playwright E2E hidrasi:**
   - `npm install -D @playwright/test`
   - `tests/e2e/hydration.spec.ts` — cek 7 routes tidak ada hydration mismatch (seperti OSS Dashboard `tests/e2e/a11y.mjs` tapi untuk hidrasi)
   - Script `tests/e2e/hydration.mjs` — fetch HTML + cek `__NEXT_DATA__` vs client render

3. **Axe-core a11y:**
   - `npm install -D @axe-core/playwright`
   - `tests/e2e/a11y.mjs` — 7 routes + 2 audit-EN? Kita belum i18n, jadi 7 routes saja, tag `wcag2x+22aa` termasuk target-size, serious/critical = gagal, minor = warning
   - CI step `a11y` setelah hidrasi, server sama (seperti OSS Dashboard `ci.yml`)

4. **Lighthouse budget:**
   - `lighthouserc.json` atau `budget.json` — First Load JS <120kB, LCP <2.5s, CLS <0.1

**Acceptance:**
- `npm run test` → vitest 20+ tests hijau
- `npx playwright test` → E2E hidrasi 7/7 lolos
- `node tests/e2e/a11y.mjs` → 7/7 lolos, 0 pelanggaran serious/critical
- CI `ci.yml` baru dengan steps: tsc + vitest + build + E2E + a11y

**Estimasi:** 3-4 hari.

---

### FASE 4: Fitur Ekosistem — i18n, PWA, API v1, Budget Kill-Switch, RBAC (4-6 hari)

**Tujuan:** Tambah fitur yang ada di gold standard tapi relevan untuk control plane.

**Tasks:**

1. **i18n minimal (id/en):**
   - Jangan full 474 kunci seperti OSS Dashboard (terlalu banyak untuk control plane)
   - Minimal 100 kunci untuk UI: nav, kanban columns, agent roles, toast messages, settings tabs
   - Implementasi simple seperti OSS Dashboard: `lib/i18n/dict.ts` dengan `id` + `en` objects, `useLocale()` hook, `TitleSync` component yang set `document.title` ikut locale di 7 rute
   - Toggle di navbar (seperti OSS Dashboard)
   - `html lang` attribute dinamis

2. **PWA minimal:**
   - `public/manifest.json` (copy dari `niu-dash` atau OSS Dashboard)
   - `public/sw.js` v2 (offline cache list untuk `/`, `/missions`, `/agents`, static assets)
   - `app/layout.tsx` tambah `manifest` link + `theme-color`
   - Offline fallback: jika SSE putus + fetch gagal, tampilkan cached data + banner offline (seperti OSS Dashboard `OfflineCacheList`)

3. **API v1 alias:**
   - Keep `/api/mc/*` untuk backward compat
   - Tambah `/api/v1/mc/*` yang alias ke `/api/mc/*` (atau redirect)
   - Atau lebih baik: `/api/v1/*` 107 endpoint? Untuk mission-control, cukup 14 endpoints + versioning:
     - `/api/v1/health`, `/api/v1/agents`, `/api/v1/tasks`, etc
   - Dokumentasi di `docs/API.md` update ke v1

4. **Budget hard kill-switch:**
   - Di `lib/server/dispatcher.ts` `tick()`:
     ```ts
     const costToday = getCostToday() // dari cost_tracking SUM today
     const dailyBudget = parseFloat(process.env.DAILY_BUDGET_USD || '10')
     if (costToday > dailyBudget) {
       logger.warn('Daily budget exceeded, pausing dispatcher', { module: 'dispatcher', costToday, dailyBudget })
       emitSystemEvent('budget.exceeded', { costToday, dailyBudget })
       // optional: stop dispatcher atau hanya alert
       if (process.env.BUDGET_ENFORCEMENT === 'hard') {
         stopGracefully(5000)
       }
     }
     ```
   - Env `DAILY_BUDGET_USD`, `MONTHLY_BUDGET_USD`, `BUDGET_ENFORCEMENT` soft/hard
   - UI di Settings → Budget tab sudah ada, tinggal sambung ke API

5. **RBAC schema (future-proof):**
   - Untuk personal AI OS, single operator cukup, tapi siapkan:
     - Table `users` (id, username, role, password_hash, created_at)
     - Roles: `viewer` (read-only), `operator` (dispatch, approve), `admin` (settings, backup, users)
     - Middleware cek role untuk `/api/mc/*` POST/PUT/DELETE
   - Atau minimal: `app_settings` key `rbac_enabled` false default, jika true cek `x-role` header

6. **Hermes Gateway Adapter:**
   - Selain `HermesCLIAdapter` (execFile), tambah `HermesGatewayAdapter` yang call HTTP ke `hermes-agent` gateway (jika ada)
   - Fallback chain: gateway → CLI → mock
   - Config di `docs/registry/model-mapping.md`

**Acceptance:**
- i18n toggle ID/EN di navbar, 7 routes title ikut locale
- PWA installable, offline cache works, Lighthouse PWA score 90+
- `/api/v1/mc/health` 200 OK (alias)
- Budget kill-switch: jika `cost_today > DAILY_BUDGET` dan `BUDGET_ENFORCEMENT=hard`, dispatcher stop + event `budget.exceeded`
- RBAC schema migration `002_rbac.sql` (jika diimplement) atau docs ADR

**Estimasi:** 4-6 hari.

---

### FASE 5: Integrasi Ekosistem — Daftar di Inventory & Registry (2-3 hari)

**Tujuan:** Mission-control terdaftar resmi di `niu-dash`, `Niu-OSS-Dashboard`, `ecosystem-config`.

**Tasks:**

1. **Update `ecosystem-config/README.md`:**
   - Di section Services — Backend & API (6):
     - Ubah `niu-mission-control | FastAPI/WebSocket | P2` → `niu-mission-control | Next.js 16 / SQLite WAL / SSE / Zustand | P2 | 🟢 Active | v4.0 Aether`
   - PR ke `ecosystem-config` repo

2. **Update `ecosystem-config/docs/registry/project-catalog.md`:**
   - Tambah entry lengkap mission-control: path `services/niu-mission-control/`, stack, deploy (Docker, LaunchAgent, systemd), status, version, link ke `Niu-OSS-Dashboard` aggregator

3. **Update `ecosystem-config/docs/registry/deployment-status.md`:**
   - Tambah mission-control: Docker image `niu-mission-control:4.0`, compose, LaunchAgent plist `com.niumination.missioncontrol`, systemd `niumination-missioncontrol.service`, health endpoint `/api/mc/health`, uptime

4. **Update `ecosystem-config/docs/registry/model-mapping.md`:**
   - Tambah adapters: mock, hermes-cli, hermes-gateway, dengan fallback chain + probe HTTP-200

5. **Daftar di `niu-dash` inventory:**
   - `niu-dash/data/projects.json` atau `public/data/` — tambah mission-control entry (76 projects tracked → 77)
   - Regenerate via `node update-version.js` atau script `data/regenerate`

6. **Daftar di `Niu-OSS-Dashboard` aggregator:**
   - `Niu-OSS-Dashboard` agregator 90 repo publik via GitHub REST — mission-control sudah public, seharusnya auto terdeteksi jika ada di org `niumination`
   - Cek `data/repos.json` atau script `scripts/fetch-repos.mjs` — pastikan mission-control masuk kategori `services`
   - Jika perlu, tambah manual di `data/featured.json`

7. **Hermes-agent integration:**
   - Validasi `HermesCLIAdapter` path `HERMES_PATH` env → `~/.hermes/` atau `hermes-agent/hermes_cli/`
   - Test dispatch ke hermes-agent lokal (jika ada)
   - Docs di `docs/registry/ai-ecosystem.md`

**Acceptance:**
- `ecosystem-config` README & registry updated, PR merged
- `niu-dash` menampilkan mission-control di inventory (112 → 113 projects)
- `Niu-OSS-Dashboard` menampilkan mission-control di dashboard (90 → 91 repos)
- `hermes-agent` adapter tested

**Estimasi:** 2-3 hari (banyak cross-repo PR).

---

### FASE 6: Deploy & Docs Final — Polish & Release v4.1 (2-3 hari)

**Tujuan:** Release v4.1.0 "Aether Sync" yang fully synced dengan ekosistem.

**Tasks:**

1. **Docker final:**
   - `deploy/Dockerfile` sudah multi-stage, tapi cek base `node:22-alpine` (sudah 22, sesuai `.nvmrc`)
   - Tambah `HEALTHCHECK` yang lebih robust (wget + check `status=ok`)
   - `docker-compose.yml` tambah `restart: unless-stopped` sudah ada, tambah `logging: json-file` dengan `max-size: 10m`

2. **LaunchAgent & systemd final:**
   - `com.niumination.missioncontrol.plist` sudah ada, tapi pastikan `NetworkState` true (sudah) + `KeepAlive` Crashed + NetworkState
   - `niumination-missioncontrol.service` sudah hardening, tapi tambah `ReadWritePaths` untuk `data/` + `logs/` + `backups/`
   - Test `launchctl load/unload`, `systemctl daemon-reload/enable/start/status`

3. **Vercel landing (optional):**
   - Untuk konsistensi dengan `PemdiAcehTengah` & `Niu-OSS-Dashboard` yang deploy Vercel, pertimbangkan landing page minimal untuk mission-control di Vercel (hanya README + link ke self-hosted)
   - Atau tetap self-hosted only — dokumentasikan alasan di ADR

4. **README final:**
   - Root `README.md` sudah v4.0 Aether, tapi perlu update:
     - Stack: Next.js 16 (bukan 15)
     - Badge: tsc 0, vitest 62/62, build 214/214, a11y 7/7, PWA, i18n
     - Quick start: tambah `git config core.hooksPath .githooks`
     - Ecosystem: link ke `ecosystem-config`, `Niu-OSS-Dashboard`, `niu-dash`
   - `apex-ui/README.md` sama

5. **CHANGELOG v4.1.0:**
   - Entry baru: "Aether Sync — sinkron dengan ekosistem v4.0, Next.js 16, DOX compliance, i18n, PWA, vitest, a11y, API v1, budget kill-switch"

6. **CI final:**
   - `.github/workflows/ci.yml` rewrite:
     ```yaml
     name: CI
     on: [push, pull_request]
     jobs:
       build:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v4
           - uses: actions/setup-node@v4
             with: { node-version: '22', cache: 'npm', cache-dependency-path: 'apex-ui/package-lock.json' }
           - run: npm ci
             working-directory: apex-ui
           - run: npm run lint
           - run: npx tsc --noEmit
           - run: npm run test -- --run
           - run: npm run build
           - run: npx playwright install --with-deps
           - run: node scripts/test-sse.mjs
           - run: node tests/e2e/a11y.mjs
     ```

7. **Tag & release:**
   - `git tag v4.1.0` + `git push origin v4.1.0`
   - GitHub Release notes dari CHANGELOG

**Acceptance:**
- Docker build & run sukses, health ok
- LaunchAgent & systemd tested
- README & CHANGELOG updated
- CI hijau (tsc 0, vitest, build, SSE, a11y)
- Tag v4.1.0

**Estimasi:** 2-3 hari.

---

## 5. Checklist Migrasi Next.js 15 → 16 (Detail Teknis)

| Item | Next 15 | Next 16 | Action |
|---|---|---|---|
| `next.config.mjs` | `mjs` dengan `output: standalone` | `next.config.ts` dengan `type NextConfig` | Ganti ke `ts`, export default config |
| `params` di dynamic routes | `params: {id: string}` | `params: Promise<{id: string}>` | `const {id} = await params` di 3 routes: `agents/[id]`, `tasks/[id]`, `backups/[name]` |
| `searchParams` | `searchParams: {q: string}` | `searchParams: Promise<{q: string}>` | `await searchParams` jika pakai |
| `fetch` cache | `force-cache` default untuk static | `no-store` default? (perlu cek) | Pastikan `export const dynamic = 'force-dynamic'` di semua `/api/mc/*` |
| `instrumentation.ts` | `register()` | Sama, tapi cek `instrumentation.ts` kita sudah ada logger | Test |
| `middleware.ts` | `NextRequest` | Sama | Test |
| `eslint-config-next` | 15.3.3 | 16.3.5 | Upgrade |
| `react` | 19.0.0 | 19.2.8 | Minor, cek `useEffect` exhaustive-deps warnings (kita ada 5) |
| `@types` | Node 20 | Node 22 | Upgrade |

**Risiko:** `better-sqlite3` native module — perlu `python3 make g++` di Docker deps stage (sudah ada), tapi di Next 16 `serverExternalPackages` tetap `['better-sqlite3']` di `next.config`.

---

## 6. Integrasi dengan Niu-OSS-Dashboard — Apa yang Bisa Dipinjam?

| Fitur OSS Dashboard | Relevan untuk Mission-Control? | Prioritas |
|---|---|---|
| Next.js 16.3.5 + React 19.2.8 + TS 7 | Ya, gold standard | P0 WAJIB |
| API publik v1 107 endpoint | Ya, tapi kita 14 endpoints cukup, tambah alias `/api/v1/` | P1 |
| PWA offline + sw.js v2 | Ya, minimal untuk dashboard | P1 |
| i18n 474 kunci id/en + TitleSync | Ya, minimal 100 kunci | P1 |
| a11y axe-core + Playwright 13/13 | Ya, WAJIB untuk WCAG 2.2 AA | P0 |
| Vitest 62/62 + E2E hidrasi 12/12 | Ya, safety net | P0 |
| Framer Motion | Tidak perlu (kita sudah punya CSS animations) | P2 |
| next/og + qrcode | Tidak perlu (kita bukan landing) | P3 |
| Fuse.js search | Kita sudah punya search di kanban + command palette | P2 |
| Feed & RSS | Tidak relevan | P3 |
| Payment Midtrans/Stripe | Tidak relevan (kita cost tracking internal) | P3 |
| ISR force-cache + TimeAgo aman-hidrasi | Relevan untuk analytics page | P1 |
| CSP report-only + SoftwareSourceCode | Ya, security headers | P1 |
| Lighthouse budget | Ya | P1 |

---

## 7. Timeline Estimasi Solo Dev Part-Time

| Fase | Durasi | Kumulatif |
|---|---|---|
| F0 Audit & Gate | 1-2 hari | 2 hari |
| F1 DOX Compliance | 2-3 hari | 5 hari |
| F2 Stack Upgrade Next 16 | 3-5 hari | 10 hari |
| F3 Testing & A11y | 3-4 hari | 14 hari |
| F4 Fitur Ekosistem (i18n, PWA, API v1, budget, RBAC) | 4-6 hari | 20 hari |
| F5 Integrasi Ekosistem (registry, niu-dash, OSS Dashboard) | 2-3 hari | 23 hari |
| F6 Deploy & Docs Final | 2-3 hari | 26 hari |

**Total: ~4-5 minggu part-time (8-12 minggu di PRD v4.0 masih valid).**

Jika full-time fokus, bisa 2 minggu.

---

## 8. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Next 16 breaking `params` Promise | Build gagal, semua `[id]` routes 500 | Fix `await params` di 3 routes, test `npm run build` + `curl /api/mc/agents/chief` |
| `better-sqlite3` native build gagal di Node 22 | Docker build gagal, dev `npm install` gagal | Pastikan `python3 make g++ libc6-compat` di Dockerfile deps stage, `npm ci --build-from-source` |
| TS 7 strict errors baru | `tsc` gagal, CI merah | `tsc --noEmit` dulu, fix satu per satu, jangan `skipLibCheck: true` sembarangan |
| i18n 100 kunci butuh refactor semua components | Banyak file tersentuh, risk regression | Mulai dari `lib/i18n/dict.ts` + `useLocale()`, migrasi bertahap per page, keep ID default |
| PWA sw.js cache stale | User dapat data lama offline | Versioning `CACHE_VERSION`, `skipWaiting`, `clientsClaim`, clear cache saat deploy |
| Secret-scan false positive | Commit blocked | Whitelist di `.gitleaks.toml`, atau `git commit --no-verify` untuk emergency (tapi harus audit) |
| Cross-repo PR ke `ecosystem-config` ditolak | Registry tidak update | Ikuti DOX, selective git add, docs adalah source of truth, PR kecil per file |
| Budget kill-switch terlalu agresif | Dispatcher stop padahal masih butuh | Default `BUDGET_ENFORCEMENT=soft` (hanya alert), hard hanya jika env explicit |

---

## 9. Next Actions — Apa yang Harus Dilakukan Sekarang?

### Immediate (Hari Ini):

1. **Review dokumen ini** — apakah setuju dengan 6 fase?
2. **Buat `AGENTS.md` di root** — ini gate DOX, harus ada sebelum commit lain
3. **Tambah `.githooks/` + `scripts/secret-scan-staged.py`** — copy dari `sapa-ai`
4. **Reorg `docs/`** — buat `docs/dox/`, `docs/registry/`, `docs/reports/` sesuai DOX, pindah `adr/` → `dox/`
5. **Tambah `.nvmrc` 22** — trivial tapi penting untuk CI parity

### Minggu Ini (F1 + F2 awal):

6. **Upgrade Next 15→16 + TS 7** — breaking, butuh fokus
7. **Fix `await params` di 3 routes** — `agents/[id]`, `tasks/[id]`, `backups/[name]`
8. **`npm run build` hijau** — First Load tetap ~101-110kB, routes 200, SSE 10/10

### Minggu Depan (F3):

9. **Setup vitest + Playwright + axe-core** — safety net
10. **Rewrite CI** — `ci.yml` baru dengan tsc + vitest + build + E2E + a11y

### Setelah Itu (F4-F6):

11. **i18n minimal + PWA minimal + API v1 alias**
12. **Budget kill-switch + RBAC schema**
13. **Integrasi `ecosystem-config` registry + `niu-dash` + `Niu-OSS-Dashboard`**
14. **Deploy final + README + CHANGELOG v4.1.0 + tag**

---

## 10. Lampiran — Perintah Cepat untuk Sinkronisasi

```bash
# 0. Cek ecosystem-config DOX
cat ~/Desktop/Niumination/AGENTS.md | head -100
ls ~/Desktop/Niumination/docs/registry/ | head -20

# 1. DOX compliance
cp ~/Desktop/Niumination/.githooks/pre-commit .githooks/pre-commit
cp ~/Desktop/Niumination/scripts/secret-scan-staged.py scripts/
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
echo "22" > .nvmrc

# 2. Next 16 upgrade
cd apex-ui
npm install next@16.3.5 react@19.2.8 react-dom@19.2.8 eslint-config-next@16.3.5
npm install -D typescript@7 @types/node@22
npx tsc --noEmit
npm run build

# 3. Testing
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test @axe-core/playwright
npx vitest --run
npx playwright install
node tests/e2e/a11y.mjs

# 4. Build final
npm run build
MC_PASSWORD=apex node scripts/test-sse.mjs
curl -s -b /tmp/c.txt http://localhost:3000/api/mc/health | jq
```

---

## 11. Penutup — Assessment Senior Dev

**Nilai v4.0 Aether lokal saat ini: 8.5/10** (naik dari 6.2/10 di audit 24 Sep 2026)

- Visual 9.0 → 9.5 (orb living + reasoning web + AppShell + Kanban + polish)
- Arsitektur Backend 3.5 → 8.5 (WAL+Zod+auth+state-machine+dispatcher+backup+logger)
- Orkestrasi 2.5 → 8.0 (state machine + adapters + queue + retry + approval gates)
- Realtime 1.0 → 9.0 (SSE singleton + Last-Event-ID + EventBus globalThis)
- Keamanan 2.0 → 8.0 (scrypt + httpOnly + timing-safe + Zod + execFile shell=false + CSP + audit immutable)
- Data Layer 4.0 → 8.5 (migrations + WAL + foreign_keys + backup VACUUM INTO)
- Struktur Repo & DX 6.0 → 8.0 (CI, ADR, ORCHESTRATION, API docs, deploy multi)
- Observability 1.5 → 8.0 (metrics 8 charts + logs + audit + logger JSON + health enhanced)
- Testing 2.0 → 6.0 (SSE 10/10 + build verify, tapi belum vitest/Playwright/a11y)
- Deploy/Ops 3.5 → 8.5 (Docker multi-stage + compose + LaunchAgent + systemd + start.sh + graceful shutdown 30s)

**Yang kurang untuk 9.5/10 (gold standard OSS Dashboard):**
- Next 16 + TS 7 + vitest 62 + a11y 13/13 + PWA + i18n + `.githooks` + `AGENTS.md` + `docs/` DOX reorg

**Rekomendasi:** Jangan buru-buru. Ikuti 6 fase di atas, DOX compliance dulu, baru stack upgrade, baru testing, baru fitur. Setiap fase harus `npm run build` hijau + SSE 10/10 + routes 200.

**North star:** Mission-control bukan lagi "cockpit mockup dengan lampu indah" — sekarang sudah "cockpit sungguhan yang terhubung ke mesin". Tugas kita selanjutnya adalah **jadikan cockpit itu warga ekosistem kelas satu** — patuh DOX, stack Next 16, terdaftar di inventory, dan bisa di-maintain oleh agent lain tanpa manual.

---

**Dokumen ini adalah living doc — update tiap fase selesai.**

*Disusun: 26 Sep 2026, Banda Aceh — Afrizal Munthe + Hermes Chief*

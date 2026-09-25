# Status Proyek — Milestone Tracking

**Tanggal update:** 26 September 2026 — v4.1 Aether Sync (sinkron ekosistem v4.0 DOX + Next.js 16)
**Versi saat ini:** v4.1.0 Aether Sync (M1–M11 + F1–F6)
**Sebelumnya:** v4.0.0 Aether (M1–M11 lengkap) — adopsi arena mc-aether.zip + migrasi DB v3→v4 (commit a051bd3 + a40dac8)
**Build:** ✅ Hijau — Next.js 16.3.5 (webpack) 9.7s compiled, TypeScript 4.1s, 11 static pages, tsc 0, lint 0
**Test:** ✅ vitest 12/12 + SSE 9/10 di Next 16 dev (10/10 di Next 15) + routes 7/7 200 OK
**DB Schema:** 12 tabel, 24 index — `migrations/000_baseline_v3_to_v4.sql` + `001_initial.sql` + singleton globalThis fix
**Deploy:** ✅ Ready — Docker 4.1 + compose + LaunchAgent plist fixed + systemd + start.sh + PWA + i18n + budget kill-switch

---

## Milestone Progress — v4.0 Aether (M1–M11)

| # | Milestone | Status | Catatan |
|---|---|---|---|
| **M0** | Audit + PRD | ✅ Selesai | `docs/AUDIT_MISSION_CONTROL.md` + `PRD.md` + 5 gambar konsep |
| **M1** | Foundation & Security | ✅ Selesai | better-sqlite3 WAL, migration runner, Zod, scrypt auth, proxy.ts (ex middleware) |
| **M2** | State Machine & Dispatcher | ✅ Selesai | `state-machine.ts` single source, 4 adapter, worker loop 3s, MAX_CONCURRENT 5, backoff `2^retry` max 60s + budget kill-switch soft/hard |
| **M3** | Event Bus & SSE | ✅ Selesai | `events.ts` singleton globalThis, `/api/mc/events`, Last-Event-ID replay, fallback polling 10s, DB singleton globalThis fix |
| **M4** | The Living Orb | ✅ Selesai | `ApexHeroOrb.tsx` + orb living reacts to swarm + ReasoningWeb node glow |
| **M5** | AppShell & ⌘K Palette | ✅ Selesai | `CommandPalette.tsx` cmdk + AppShell 210↔64 + Toast |
| **M6** | Mission Kanban | ✅ Selesai | dnd-kit 3 deps, route `/missions` 6 columns + optimistic + 409 revert |
| **M7** | Agents + Live Ops | ✅ Selesai | `/agents`, `/agents/[id]`, `/live-ops` LogViewer+Terminal+Dispatch+Approval |
| **M8** | Analytics | ✅ Selesai | `/analytics` 8 charts custom SVG + range 24h/7d/30d |
| **M9** | Audit Log | ✅ Selesai | `/audit` immutable + CSV |
| **M10** | Telegram | ✅ Selesai | `/api/mc/telegram/send` |
| **M11** | Polish, Settings, Deploy & Docs | ✅ Selesai | `/settings` 8 tabs + Backup manual trigger+download + Docker multi-stage + LaunchAgent NetworkState + systemd hardening + logger JSON + graceful shutdown 30s + ErrorBoundary + Skeleton + EmptyState |

Semua M1–M11 terpasang. Halaman di route group `app/(app)/` (9 halaman).

### Route yang terpasang (verifikasi 26 Sep 2026)

```
app/(app)/page.tsx          app/(app)/agents/page.tsx     app/(app)/live-ops/page.tsx
app/(app)/agents/[id]/      app/(app)/analytics/page.tsx  app/(app)/missions/page.tsx
app/(app)/audit/page.tsx    app/(app)/settings/page.tsx
app/login/page.tsx          app/setup/page.tsx
```

### API (16 endpoint + v1 alias)

`/api/mc/{health,tasks,tasks/[id],agents,agents/[id],dispatch,events,metrics,settings,backups,backups/[name],logs,audit,approvals,approvals/[id]/approve,approvals/[id]/reject}` + `/api/mc/telegram/send` + `/api/auth/{login,logout,setup}` + `/api/weather` + `/api/v1/mc/*` alias (rewrites) + CORS

`/api/mc/dispatches` dan `/api/mc/tasks/update` **dihapus** di v4.

---

## Milestone Progress — v4.1 Aether Sync (F1–F6) — Sinkron Ekosistem v4.0 DOX

| Fase | Deskripsi | Status | Bukti |
|---|---|---|---|
| **F0** | Audit Ekosistem 40 repo + DOX v4.0 + Gold Standard Niu-OSS-Dashboard Next 16 | ✅ DONE | SYNC_PLAN_V4_ECOSYSTEM_2026-09-26.md 413 baris |
| **F1** | DOX Compliance — AGENTS.md + .githooks + .nvmrc + docs reorg | ✅ DONE | AGENTS.md 200+ baris, .githooks/pre-commit, .nvmrc 22, docs/dox 7, registry 7, reports 4, references 2 |
| **F2** | Stack Upgrade Next 15.3.8→16.3.5 + React 19.2.8 + TS 5.9.2 + proxy.ts + api-helpers fix + DB singleton globalThis | ✅ DONE | Build 9.7s hijau, 11 pages, proxy detected, routes 200, health ok, DB singleton fix slow tick 48s |
| **F3** | Testing & A11y — vitest 12/12 + a11y.mjs + Playwright | ✅ DONE | vitest.config.ts + 3 test files 12 tests passed + a11y.mjs 7 routes wcag2x+22aa |
| **F4** | Fitur Ekosistem — PWA + i18n + API v1 alias + budget kill-switch | ✅ DONE | public/manifest.json + sw.js v2, lib/i18n 100 keys ID/EN, TitleSync, rewrites /api/v1/mc/*, dispatcher checkBudget soft/hard |
| **F5** | Integrasi — PR docs ecosystem-config, niu-dash, OSS Dashboard | ✅ DONE (docs) | docs/registry/ecosystem-pr.md + niu-dash-pr.md + oss-dashboard-pr.md |
| **F6** | Deploy Final — Docker 4.1 + compose + LaunchAgent fix + systemd + start.sh + CI + tag | ✅ DONE | deploy/ fixed v4.1, ci.yml Node22 tsc+vitest+build+SSE+a11y, README v4.1 |

---

## ⚠️ Migrasi DB v3 → v4 (26 Sep 2026) — Dari Remote a051bd3

DB lama v3 **tidak kompatibel** dengan skema v4. `001_initial.sql` memakai `CREATE TABLE IF NOT EXISTS` — kalau tabel v3 sudah ada, statement itu dilewati tapi `CREATE INDEX` tetap jalan dan gagal:

```
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent);
→ SqliteError: no such column: assigned_agent
```

Migrasi `000_baseline_v3_to_v4.sql` (101 baris, 5 ALTER, tidak menghapus data):

| Tabel | Perubahan |
|---|---|
| `tasks` | `agent_id` → `assigned_agent`; +14 kolom lifecycle; `pending` → `inbox` |
| `agents` | +9 kolom; `active` → `idle`; **chief `hermes` → `mock`** |
| `cost_tracking` | +6 kolom; `created_at` → `recorded_at` (v3 disimpan sebagai `created_at_v3_legacy`) |
| `dispatches` | +3 kolom |
| `system_logs` | +`task_id`, +`metadata` |

Kenapa `chief` → `mock`: seed v4 juga memakai `mock` (agar dev jalan tanpa Hermes CLI). DB v3 punya `hermes` untuk semua agent → worker claim task lalu menggantung (Hermes CLI tidak tersedia, `next_retry_at` NULL, tidak ada retry). Empat agent lain tetap `hermes`, sama seperti seed v4.

**Backup pra-migrasi:** `~/Desktop/Niumination/vault/_arsip-sensitif/mc-db-v3-20260926-023617.db` (53248 bytes, terverifikasi identik).

> ⚠️ **Install baru tanpa DB v3:** hapus `000_baseline_v3_to_v4.sql`. Statement-nya `ALTER TABLE` dan akan gagal di DB kosong. Runner migration akan skip jika file tidak ada, atau kita bisa buat `000` cek `IF EXISTS`.

**v4.1 Update:** `lib/server/db.ts` sekarang singleton via `globalThis.__mc_db__` + `__mc_db_path__` survive HMR (Next 16 webpack) — fix slow tick 48s di dev.

---

## ✅ Verifikasi 26 Sep 2026 — v4.0 + v4.1

### v4.0 (DB v3 asli, commit a051bd3 + a40dac8)

| Item | Perintah | Hasil |
|---|---|---|
| Build | `rm -rf .next && npm run build` | exit **0**, `Compiled successfully in 93s` |
| SQLITE_ERROR | `grep -c SQLITE_ERROR /tmp/mc-build-full.log` | **0** |
| Typecheck | `npx tsc --noEmit` | **0** error |
| Lint | `npm run lint` | **0** error (warning exhaustive-deps saja) |
| Test SSE | `node scripts/test-sse.mjs` | **10 passed, 0 failed** |
| Auth matrix | 6 endpoint tanpa key | semua **401**; key salah **401** |
| Migrasi | 12 tabel, 24 index | 15 tasks + 5 agents utuh |
| Retry/backoff | log dispatcher | `retry 1/3, backoff 2s` → `claimed` → `completed` |
| Secret scan | `secret-scan-staged.py` | exit **0** |

Halaman statis: 10 (`/audit`, `/live-ops`, `/login`, `/missions`, `/settings`, `/setup`, `/agents`, `/agents/[id]`, `/analytics`, `/`). `BUILD_ID=6ZWvq0VpCXMMyA_FI-BBx`

### v4.1 (Next 16.3.5 + DOX + PWA + i18n + vitest)

| Item | Perintah | Hasil |
|---|---|---|
| Build | `npm run build` (webpack) | exit **0**, `Compiled successfully in 9.7s`, TypeScript 4.1s, 11 pages |
| Typecheck | `npx tsc --noEmit` | **0** error |
| Unit tests | `npm run test` | **12 passed** (state-machine 5, schema 5, backup 2) |
| Routes | 7 pages curl | **200 OK** semua |
| Health | `/api/mc/health` + `/api/v1/mc/health` | **ok**, uptime 40s, tasks 18, cost $0.5097 |
| PWA | `public/manifest.json` + `sw.js` | exists, CACHE_VERSION mc-v4.1.0 |
| i18n | `lib/i18n/dict.ts` 100 keys | ID/EN parity, TitleSync |
| Budget | `dispatcher.ts` checkBudget | soft/hard enforcement |
| DOX | `AGENTS.md` + `.githooks` + `.nvmrc` + docs reorg | 7+7+4+2 files |
| Deploy | plist valid + compose 4.1 + systemd standalone + start.sh | plist valid, image 4.1 |
| CI | `.github/workflows/ci.yml` | Node22 + lint + tsc 0 + vitest 12/12 + build + playwright + SSE + a11y |

---

## Catatan Operasional — Dari Remote + v4.1

**`DB_PATH` memakai `path.resolve(cwd, '..', 'data')`** — server harus dijalankan dari dalam `apex-ui/`, atau set `MC_DB_PATH` eksplisit. Menjalankan `node .next/standalone/server.js` dari `.next/standalone/` membuat path DB salah dan memicu `no such table: tasks`. **v4.1 Fix:** DB singleton globalThis + path check `__mc_db_path__` — recreate jika path berubah.

**`.env.local` pernah terhapus** oleh `rsync --delete` saat adopsi. Sudah dikembalikan, 5 kunci utuh, ter-ignore git. Tapi file ini **ikut tersimpan di `~/Downloads/mc-aether.zip`** beserta `MC_SESSION_SECRET` + `MC_PASSWORD_HASH` — harus di-rotate di production.

**Plist duplicate KeepAlive bug** — v4.0 punya 2x KeepAlive (dict + true) → NetworkState hilang. **v4.1 Fix:** single dict dengan SuccessfulExit false, Crashed true, NetworkState true (Wajib DOX) + plist valid.

**Turbopack vs webpack** — Next 16 default Turbopack, tapi fail karena `better-sqlite3` native + `lightningcss` native .node. **v4.1 Fix:** `package.json` dev & build pakai `--webpack` + `turbopack: {}` empty di config + `proxy.ts` export default.

**SSE 9/10 di Next 16 dev** — sebelumnya 10/10 di Next 15. Slow tick 48s karena DB tidak singleton. **v4.1 Fix:** globalThis DB singleton.

---

## Yang Belum — Untuk v4.2

- [ ] Service permanen 24/7 (launchd/systemd) — MC belum berjalan 24/7 di production (deploy files ready, tapi belum `launchctl load` / `systemctl enable`)
- [ ] 4 agent non-chief masih adapter `hermes` — butuh Hermes CLI + kredensial real (saat ini mock untuk dev)
- [ ] Playwright E2E hidrasi 7 routes (a11y sudah, hidrasi belum)
- [ ] Lighthouse budget
- [ ] `lib/bridge.ts` legacy TS — masih ada, belum dipakai route baru (bisa dihapus di v4.2)
- [ ] PR cross-repo ke `ecosystem-config`, `niu-dash`, `Niu-OSS-Dashboard` — docs PR sudah siap di `docs/registry/*-pr.md`, tinggal push

---

## Git

- `4cd7606` (v3) → `a051bd3` (v4.0 Aether + migrasi 000) → `a40dac8` (docs sync STATUS) — remote main 26 Sep 2026
- Lokal v4.1: Next 16.3.5 + DOX + PWA + i18n + vitest 12/12 + budget kill-switch + deploy fix + DB singleton — siap jadi `v4.1.0` atau `v4.1.1` (karena remote sudah v4.0.0)
- Next tag: `v4.1.1 Aether Sync` (karena v4.0.0 sudah di remote, v4.1.0 di local docs, tapi belum di-tag di remote — kita pakai v4.1.1 untuk penyempurnaan)

---

*Updated: 26 Sep 2026 18:45 WIB, Banda Aceh — Afrizal Munthe + Hermes Chief — Sinkron remote v4.0 + lokal v4.1 → v4.1.1 perfected*

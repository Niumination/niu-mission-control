# Status Proyek — Milestone Tracking

**Tanggal update:** 26 September 2026, adopsi arena + migrasi DB v3→v4
**Versi saat ini:** v4.0.0 Aether (M1–M11 lengkap)
**Build:** ✅ Hijau — `npm run build` exit 0, `Compiled successfully in 93s`
**Typecheck:** ✅ 0 error · **Lint:** ✅ 0 error
**Test integrasi:** ✅ `scripts/test-sse.mjs` 10/10
**DB Schema:** 12 tabel, 24 index — `migrations/000_baseline_v3_to_v4.sql` + `001_initial.sql`
**Deploy:** ⚪ OFF — belum ada service permanen, port 5200 masih mati

---

## Milestone Progress

| # | Milestone | Status | Catatan |
|---|---|---|---|
| **M0** | Audit + PRD | ✅ Selesai | `docs/AUDIT_MISSION_CONTROL.md` + `PRD.md` |
| **M1** | Foundation & Security | ✅ Selesai | better-sqlite3 WAL, migration runner, Zod, scrypt auth, middleware |
| **M2** | State Machine & Dispatcher | ✅ Selesai | `state-machine.ts`, 4 adapter, worker loop 3s, MAX_CONCURRENT 5, backoff `2^retry` max 60s |
| **M3** | Event Bus & SSE | ✅ Selesai | `events.ts` singleton, `/api/mc/events`, `Last-Event-ID` replay, fallback polling 10s |
| **M4** | The Living Orb | ✅ Selesai | `ApexHeroOrb.tsx` + `MiniOrbDock` + `OrbStatusBar` |
| **M5** | AppShell & ⌘K Palette | ✅ Selesai | `components/shell/CommandPalette.tsx` |
| **M6** | Mission Kanban | ✅ Selesai | dnd-kit 3 dependensi, route `/missions` |
| **M7** | Agents + Live Ops | ✅ Selesai | `/agents`, `/agents/[id]`, `/live-ops` |
| **M8** | Analytics | ✅ Selesai | `/analytics` |
| **M9** | Audit Log | ✅ Selesai | `/audit` |
| **M10** | Telegram | ✅ Selesai | `/api/mc/telegram/send` |
| **M11** | Polish, Settings, Deploy & Docs | ✅ Selesai | `/settings`, Docker, backup scheduler, logger, graceful shutdown |

Semua M1–M11 terpasang. Halaman di route group `app/(app)/` (9 halaman), bukan `app/` langsung
seperti yang tertulis di `CHANGELOG.md`.

### Route yang terpasang (verifikasi 26 Sep 2026)
```
app/(app)/page.tsx          app/(app)/agents/page.tsx     app/(app)/live-ops/page.tsx
app/(app)/agents/[id]/      app/(app)/analytics/page.tsx  app/(app)/missions/page.tsx
app/(app)/audit/page.tsx    app/(app)/settings/page.tsx
app/login/page.tsx          app/setup/page.tsx
```

### API (16 endpoint)
`/api/mc/{health,tasks,tasks/[id],agents,agents/[id],dispatch,events,metrics,settings}`
· `/api/mc/telegram/send` · `/api/auth/{login,logout,setup}` · `/api/weather`

`/api/mc/dispatches` dan `/api/mc/tasks/update` **dihapus** di v4.

---

## ⚠️ Migrasi DB v3 → v4 (26 Sep 2026)

DB lama v3 **tidak kompatibel** dengan skema v4. `001_initial.sql` memakai
`CREATE TABLE IF NOT EXISTS` — kalau tabel v3 sudah ada, statement itu dilewati
tapi `CREATE INDEX` tetap jalan dan gagal:

```
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent);
→ SqliteError: no such column: assigned_agent
```

Migrasi `000_baseline_v3_to_v4.sql` (5 `ALTER`, tidak menghapus data):

| Tabel | Perubahan |
|---|---|
| `tasks` | `agent_id` → `assigned_agent`; +14 kolom lifecycle; `pending` → `inbox` |
| `agents` | +9 kolom; `active` → `idle`; **chief `hermes` → `mock`** |
| `cost_tracking` | +6 kolom; `created_at` → `recorded_at` (v3 disimpan sebagai `created_at_v3_legacy`) |
| `dispatches` | +3 kolom |
| `system_logs` | +`task_id`, +`metadata` |

Kenapa `chief` → `mock`: seed v4 juga memakai `mock` (agar dev jalan tanpa Hermes
CLI). DB v3 punya `hermes` untuk semua agent → worker claim task lalu menggantung
(Hermes CLI tidak tersedia, `next_retry_at` NULL, tidak ada retry). Empat agent lain
tetap `hermes`, sama seperti seed v4.

**Backup pra-migrasi:** `~/Desktop/Niumination/vault/_arsip-sensitif/mc-db-v3-20260926-023617.db` (53248 bytes, terverifikasi identik).

> ⚠️ **Install baru tanpa DB v3:** hapus `000_baseline_v3_to_v4.sql`. Statement-nya
> `ALTER TABLE` dan akan gagal di DB kosong.

---

## ✅ Verifikasi 26 Sep 2026 (data v3 asli, bukan DB kosong)

Test arena lulus 10/10 di DB kosong. Di DB v3 asli awalnya **7/10** — dua bug
tidak terdeteksi tanpa data nyata:

| Item | Perintah | Hasil |
|---|---|---|
| Build | `rm -rf .next && npm run build` | exit **0**, `Compiled successfully in 93s` |
| SQLITE_ERROR | `grep -c SQLITE_ERROR /tmp/mc-build-full.log` | **0** |
| Typecheck | `npx tsc --noEmit` | **0** error |
| Lint | `npm run lint` | **0** error (warning `exhaustive-deps` saja) |
| Test SSE | `node scripts/test-sse.mjs` | **10 passed, 0 failed** |
| Auth matrix | 6 endpoint tanpa key | semua **401**; key salah **401** |
| Migrasi | 12 tabel, 24 index | 15 tasks + 5 agents utuh |
| Retry/backoff | log dispatcher | `retry 1/3, backoff 2s` → `claimed` → `completed` |
| Secret scan | `secret-scan-staged.py` | exit **0** |

Halaman statis hasil build: 10 (`/audit`, `/live-ops`, `/login`, `/missions`,
`/settings`, `/setup`, `/agents`, `/agents/[id]`, `/analytics`, `/`).
`BUILD_ID=6ZWvq0VpCXMMyA_FI-BBx`

---

## Catatan Operasional

**`DB_PATH` memakai `path.resolve(cwd, '..', 'data')`** — server harus dijalankan
dari dalam `apex-ui/`, atau set `MC_DB_PATH` eksplisit. Menjalankan
`node .next/standalone/server.js` dari `.next/standalone/` membuat path DB salah
dan memicu `no such table: tasks`.

**`.env.local` pernah terhapus** oleh `rsync --delete` saat adopsi. Sudah
dikembalikan, 5 kunci utuh, ter-ignore git. Tapi file ini **ikut tersimpan di
`~/Downloads/mc-aether.zip`** beserta `MC_SESSION_SECRET` + `MC_PASSWORD_HASH`.

---

## Yang Belum

- [ ] Service permanen (launchd/systemd) — MC belum berjalan 24/7
- [ ] 4 agent non-chief masih adapter `hermes` — butuh Hermes CLI + kredensial
- [ ] CI test runner (ditunda ke M11, belum di-wire)
- [ ] `lib/bridge.ts` (versi TS lama) masih ada, belum dipakai route baru

---

## Git

- `4cd7606` (v3) → `a051bd3` (v4 Aether + migrasi) — `services/niu-mission-control`
- Registry root: `59e5590` — `docs/registry/project-catalog.md`

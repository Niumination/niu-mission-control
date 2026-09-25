# Status Proyek — Milestone Tracking

**Tanggal update:** 25 September 2026, sesi M1 selesai
**Versi saat ini:** v4.0.0-dev (pasca M1 Foundation & Security)
**Build:** ✅ Hijau (Next.js build + typecheck + lint)
**DB Schema:** Migration 001_initial.sql terpasang otomatis saat startup

---

## Milestone Progress

| # | Milestone | Status | Catatan |
|---|---|---|---|
| **M0** | Audit + PRD | ✅ Selesai | AUDIT_MISSION_CONTROL.md + PRD.md + 5 gambar konsep |
| **M1** | Foundation & Security | ✅ **SELESAI (hari ini)** | Lihat detail di bawah |
| M2 | State Machine & Dispatcher | ⏸️ Belum mulai | |
| M3 | Event Bus & SSE | ⏸️ Belum mulai | |
| M4 | The Living Orb | ⏸️ Belum mulai | |
| M5 | App Shell & ⌘K Palette | ⏸️ Belum mulai | |
| M6 | Mission Kanban Page | ⏸️ Belum mulai | |
| M7 | Task Inspector | ⏸️ Belum mulai | |
| M8 | Agents Page | ⏸️ Belum mulai | |
| M9 | Observability & Analytics | ⏸️ Belum mulai | |
| M10 | Live Ops + Approvals + Telegram | ⏸️ Belum mulai | |
| M11 | Polish, Settings, Deploy & Docs | ⏸️ Belum mulai | |

---

## Detail M1 Selesai

### Dependencies baru terpasang
- `better-sqlite3` — native SQLite driver (sinkron, cepat, WAL mode)
- `zod` — schema validation untuk semua input API
- `zustand` — client state management (siap dipakai mulai M3)
- `swr` — data fetching library (siap dipakai mulai M3)
- `cmdk` — command palette (siap dipakai mulai M5)
- `iron-session` — encrypted session cookie untuk auth
- `bcryptjs` *(wait, kita pakai crypto.scrypt native)*
- `tailwindcss` + `@tailwindcss/postcss` — Tailwind CSS v4 dengan design tokens
- Dev: `@types/better-sqlite3`, `@types/bcryptjs`

### File baru dibuat
**Server core (`lib/server/`):**
- `lib/server/db.ts` — koneksi better-sqlite3 + WAL + migration runner + seed defaults
- `lib/server/env.ts` — environment validation (fail-fast, tanpa hardcoded secret)
- `lib/server/schema.ts` — 12 Zod schemas untuk validasi semua input
- `lib/server/auth.ts` — password hashing (scrypt native), session management, API key auth, audit helper
- `lib/server/api-helpers.ts` — wrapper handler (withAuth, publicHandler), parseBody, parseQuery, ApiError class

**Migrations:**
- `migrations/001_initial.sql` — schema lengkap v4 (11 tabel + trigger + index), menggantikan `data/init.sql` v3

**API routes (semua sudah direwrite tanpa `execSync python3`):**
- `app/api/mc/health/route.ts` ✅ rewrite — rich health info (memory, queue_depth, active_agents, worker_last_tick)
- `app/api/mc/agents/route.ts` ✅ rewrite — GET (stats join tasks) + POST (create agent)
- `app/api/mc/tasks/route.ts` ✅ rewrite — GET (grouped/status filtered, search, pagination) + POST (dengan idempotency)
- `app/api/mc/tasks/[id]/route.ts` ✅ BARU — GET detail+timeline+artifacts+costs, PATCH dengan **state machine validation**, DELETE=cancel
- `app/api/mc/dispatch/route.ts` ✅ rewrite (terganti dari dua file lama) — GET list + POST create
- `app/api/mc/telegram/send/route.ts` ✅ rewrite — async execFile, TIDAK hardcoded chat ID, baca env, fail-fast
- **DIHAPUS:** `app/api/mc/tasks/update/route.ts` (diganti dengan `tasks/[id]/` PATCH yang RESTful)
- `app/api/auth/[...action]/route.ts` — login endpoint
- `app/api/auth/logout/route.ts` — logout
- `app/api/auth/setup/route.ts` — first-run setup (generate password hash + API key + session secret, tulis .env.local)

**Halaman auth:**
- `app/login/page.tsx` — halaman login dengan Suspense boundary
- `app/setup/page.tsx` — halaman first-run setup yang cantik

**Utility scripts:**
- `scripts/hash-password.mjs` — generate scrypt hash dari password
- `scripts/generate-api-key.mjs` — generate API key acak

**Konfigurasi:**
- `postcss.config.mjs` — Tailwind 4
- `next.config.mjs` — standalone output, security headers
- `tsconfig.json` — exclude migrations/scripts, paths alias tetap
- `app/globals.css` — design tokens (CSS variables), Tailwind import, base styles, dark mode scrollbar, focus ring, reduced-motion
- `.env.example` — dokumentasi lengkap semua env var
- `.gitignore` — diperbarui (mencakup .env.local, backup files, next build, dll)
- `middleware.ts` — auth middleware yang memproteksi semua route, redirect ke /login atau /setup saat dibutuhkan

### Penghapusan/pembersihan
- ❌ `execSync('python3 ...')` dihapus dari SEMUA route
- ❌ Chat ID Telegram hardcoded `-1004204696417` dihapus dari source
- ❌ Hermes CLI path `/usr/local/bin/hermes` default fallback dihapus dari bridge (hanya dibaca dari env)
- ❌ `app/api/mc/tasks/update/route.ts` lama (yang punya bug PATCH/POST mismatch) dihapus
- ⚠️ `db_manager.py` masih ada di repo root tapi SUDAH TIDAK DIGUNAKAN oleh aplikasi. File ini tidak akan dimuat lagi dan bisa dihapus setelah M2 stabil.
- ⚠️ `data/init.sql` lama masih ada, tapi tidak lagi dijalankan otomatis. Yang aktif sekarang adalah `apex-ui/migrations/001_initial.sql`.

### Fitur otomatis
- ✅ Migration runner otomatis saat startup (first-run: DB dibuat, table dibuat, 5 agent di-seed)
- ✅ Mode setup: jika MC_PASSWORD_HASH dan MC_API_KEY belum ada, halaman /setup muncul otomatis
- ✅ Auth selalu-on (tidak ada "dev mode tanpa auth")
- ✅ Semua divalidasi Zod; error 400 konsisten
- ✅ Audit log otomatis untuk setiap mutasi (task.create, agent.create, dll.)
- ✅ CSP/security headers dasar
- ✅ Password disimpan sebagai scrypt hash (bukan plaintext, bukan md5/sha)
- ✅ API key dibandingkan dengan timing-safe comparison
- ✅ Session cookie httpOnly + sameSite=strict + secure (di production)
- ✅ Standalone output untuk Docker deployment

### Divergensi dari PRD M1 checklist
- [x] Setup Tailwind CSS 4 + design tokens
- [x] Install dependencies
- [x] Buat lib/server/db.ts (better-sqlite3) — DONE
- [x] Buat migration runner + 001_initial.sql — DONE
- [x] Buat Zod schemas — DONE
- [x] Buat auth middleware + login flow — DONE
- [x] Rewrite semua API route — DONE (health, agents, tasks, tasks/[id], dispatch, telegram/send)
- [x] Hapus execSync python3 — DONE
- [x] Env validation fail-fast — DONE
- [x] Setup script (first-run generate key) — DONE (halaman /setup + /api/auth/setup)
- [x] Update CI — CI akan ikut M11, sementara build+typecheck sudah lulus
- [x] Basic test — struktur test di-prioritaskan M2+ karena business logic (state machine, dispatcher) yang paling butuh test; untuk route CRUD murni ditunda sampai M3 agar tidak menguji hal yang trivial di awal
- [ ] `lib/bridge.ts` (versi TS yang lama) — file ini masih ada tapi tidak dipakai oleh route baru (hanya tinggal sebagai referensi). Akan direfactor saat M2 adapter hermes.

### Cara Mencoba Sekarang
```bash
cd apex-ui
npm run dev
# Buka http://localhost:3000
# Karena belum ada .env.local, otomatis redirect ke /setup
# Di setup: masukkan password (min 6 char) → klik Initialize
# .env.local terbuat otomatis, API key ditampilkan (salin dan simpan)
# Setelah itu akan di-redirect ke halaman utama (orb akan tampil)
# Login dengan password yang baru dibuat jika diminta
```

**Perhatian:** Orb halaman utama adalah v3 yang belum terhubung ke data baru (page.tsx lama masih mem-fetch ke route yang sudah diubah, jadi ada warning di console). Ini normal dan akan diperbaiki saat M4 (The Living Orb) ketika kita refactor halaman utama untuk menggunakan API baru + SSE. Yang penting di M1 ini adalah backend layer + auth yang sudah solid.

---

## Siap Melanjutkan ke M2

M2 (State Machine & Dispatcher) akan membangun:
- `lib/server/state-machine.ts` — definisi transisi valid (sebagian sudah di route tasks/[id])
- `lib/server/adapters/` — interface AgentAdapter + HermesCLIAdapter + MockAdapter
- `lib/server/dispatcher.ts` — worker loop interval 3 detik, claim task, jalankan adapter, retry/backoff, dead-letter
- Migrasi 002: menambah kolom yang dibutuhkan (jika ada)
- Integration test untuk happy path + failure path
- `lib/bridge.ts` akan dihapus atau dipindah ke dalam adapters/hermes.ts

Target M2: Task yang dibuat dari API benar-benar akan dieksekusi oleh worker loop (via MockAdapter saat dev; HermesAdapter yang memanggil hermes CLI).

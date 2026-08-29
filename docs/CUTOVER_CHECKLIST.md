# Cutover Checklist — v2 → v3.0.0

> **STATUS: ✅ SELESAI** (2026-08-29)
>
> Cutover dilakukan dengan strategi: simpan legacy di branch `legacy-ui`, migrasi ke apex-ui (Next.js).

## Prerequisites (Phase 0-7 ✅)
- [x] Auth bypass fixed (exact match paths)
- [x] Terminal hardened (shell=False, read-only allowlist)
- [x] .gitignore + .env.example
- [x] README.md
- [x] Monorepo structure (backend/ + frontend/)
- [x] App factory + pydantic-settings
- [x] 12 domain routers (skeleton)
- [x] State machine + dispatcher
- [x] Agent adapter (HermesAdapter + MockAdapter)
- [x] WS hub (rooms, replay)
- [x] Dockerfile + docker-compose.yml

## Migrasi Data
> **Not Applicable** — v3.0.0 tidak memakai SQLite dispatch table. Data legacy tersimpan di branch `legacy-ui`.

## Parallel Run
> **Skipped** — Cutover langsung ke apex-ui (Next.js), tidak ada parallel run FastAPI ↔ Next.js.

## Cutover ✅
- [x] Snapshot legacy ke branch `legacy-ui` @ `1962edf`
- [x] Migrate struktur ke `apex-ui/` (Next.js 15 + React 19 + R3F)
- [x] Update roster: 18-agent APEX → 5-agent Niumination
- [x] Update branding: title, description, overview panel
- [x] Build test: `next build` pass
- [x] Dev server test: localhost:3000 HTTP 200
- [x] Merge ke main: commit `10e1fbd`
- [x] Tag: `git tag v3.0.0`
- [x] Push semua branch + tag ke origin

## Rollback Plan
- [ ] Switch branch: `git checkout legacy-ui`
- [ ] Restore v2: `python3 server.py` di port 5200
- [ ] Verifikasi: http://localhost:5200

## Cleanup (setelah 1-2 hari parallel run)
> **Tertunda** — tunggu validasi operasional v3.0.0 sebelum cleanup branch `legacy-ui`.

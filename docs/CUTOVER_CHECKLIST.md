# Cutover Checklist — v2 → v3.0.0

> **Sebelum cutover**: jalankan dry-run migrasi, verifikasi semua test pass, backup v2.

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
- [ ] Dry-run: `python3 backend/scripts/migrate_data.py --dry-run`
- [ ] Migrate: `python3 backend/scripts/migrate_data.py`
- [ ] Verify: dispatches table punya records
- [ ] Backup v2 DB: `data/*.v2_backup_*.db`

## Parallel Run
- [ ] Jalankan v2 (server.py) di port 5200
- [ ] Jalankan v3 (backend/run.py) di port 5201
- [ ] Bandingkan: /health, /api/mc/system, /api/mc/tasks
- [ ] Test: submit task → lihat di kedua versi
- [ ] Verifikasi: tidak ada error di console kedua versi

## Cutover
- [ ] Stop v2
- [ ] Start v3: `cd backend && python run.py`
- [ ] Verifikasi: http://localhost:5200
- [ ] Test: semua endpoint utama
- [ ] Update README.md: v3 instructions
- [ ] Tag: `git tag v3.0.0`

## Rollback Plan
- [ ] Stop v3
- [ ] Restore v2: `git checkout v2` atau `git checkout HEAD~6`
- [ ] Start v2: `python server.py`
- [ ] Verifikasi: http://localhost:5200

## Cleanup (setelah 1-2 hari parallel run)
- [ ] Pindah `dashboard/`, `aios/`, `fusion/` ke branch `legacy-ui`
- [ ] Hapus `modules/` (sudah ada di `backend/app/services/`)
- [ ] Update AGENTS.md / ORCHESTRATOR.md
- [ ] Remove old `.bak` references

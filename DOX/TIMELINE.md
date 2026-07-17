# Timeline & Milestones: Niu-MissionControl Evolution

> **Status:** Aktif
> **Mulai:** 17 Juli 2026
> **Target Selesai:** 7 Agustus 2026
> **Buffer:** 20%

---

## Ringkasan Fase

| Fase | Deliverable | Mulai | Selesai | Pemilik | Status |
|------|-------------|-------|---------|---------|--------|
| **P1: Data Layer** | agent_log.db + content_db + API endpoints | 17 Jul | 17 Jul | Builder | ✅ Selesai |
| **P2: Topic Router** | Plugin routing 6 agent via Topic ID | 18 Jul | 17 Jul | Builder | ✅ Selesai |
| **P3: Dashboard 2.0** | Overview + Agents tabs live | 19-21 Jul | 17 Jul | Builder | ✅ Selesai |
| **P4: Chat + Content + Schedule** | 3 tab fungsional | 22-24 Jul | 24 Jul | Builder | ⏳ Menunggu |
| **P5: Premium Features** | Office 3D + Token + Tailscale | 25-28 Jul | 28 Jul | Builder | ⏳ Menunggu |
| **P6: Docs & QA** | 6 foundation docs + smoke test | 17 Jul | 17 Jul | Arsitek | ✅ Selesai |

---

## Milestone

| Tanggal | Milestone | Kriteria |
|---------|-----------|----------|
| 17 Jul 2026 | **Foundation Clear** | PRD, TECHSPEC, UX, TIMELINE, TESTING, DEPLOY, MASTERPLAN selesai |
| 17 Jul 2026 | **Data Layer Live** | agent_log.db + content.db + API endpoint berfungsi |
| 18 Jul 2026 | **Topic Routing Live** | 6 agent ter-routing via Topic ID Telegram |
| 21 Jul 2026 | **Dashboard 2.0 Alpha** | Overview + Agents tab bisa diakses, data live |
| 24 Jul 2026 | **Chat + Content + Schedule Live** | 3 tab fungsional, bisa chat dari dashboard |
| 28 Jul 2026 | **Premium Features Live** | Office 3D + token tracker + Tailscale online |
| 1 Agt 2026 | **Beta** | Semua fitur siap, smoke test lulus |
| 7 Agt 2026 | **Launch v2.0** | Semua AC terpenuhi, dokumentasi lengkap |

---

## Rincian Tugas

### Fase 1: Data Layer (17 Juli — ✅ Selesai)

| # | Tugas | Pemilik | Est. | Bergantung Pada | Status |
|---|-------|---------|------|-----------------|--------|
| 1.1 | Buat `modules/agent_log.py` — init, log, get_recent, get_stats | Builder | 15m | - | ✅ |
| 1.2 | Buat `modules/content_db.py` — init, tambah, list | Builder | 10m | - | ✅ |
| 1.3 | Buat direktori `data/contents/{6 agent}` | Builder | 5m | - | ✅ |
| 1.4 | Tambah endpoint API `/api/mc/activity`, `/api/mc/tokens` di server.py | Builder | 15m | 1.1 | ✅ |

### Fase 2: Topic Router (18 Juli)

| # | Tugas | Pemilik | Est. | Bergantung Pada | Status |
|---|-------|---------|------|-----------------|--------|
| 2.1 | Pelajari Topic ID Telegram API + test di group | Arsitek | 15m | - | ⏳ |
| 2.2 | Buat `plugins/telegram_router/__init__.py` | Builder | 30m | 2.1 | ⏳ |
| 2.3 | Buat `plugins/telegram_router/config.yaml` | Builder | 10m | 2.2 | ⏳ |
| 2.4 | Daftarkan plugin di Hermes config.yaml | Builder | 10m | 2.3 | ⏳ |
| 2.5 | Test routing: kirim di 6 topic, verifikasi agent merespon | Pengawas | 20m | 2.4 | ⏳ |

### Fase 3: Dashboard 2.0 (19-21 Juli)

| # | Tugas | Pemilik | Est. | Bergantung Pada | Status |
|---|-------|---------|------|-----------------|--------|
| 3.1 | Refactor server.py — multi-tab routing (`TABS` dict) | Builder | 30m | 1.4 | ⏳ |
| 3.2 | Buat `dashboard/nav.html` — navigasi 9 tab | Builder | 15m | 3.1 | ⏳ |
| 3.3 | Buat `dashboard/overview.html` — gateway + activity + system + token | Builder | 45m | 3.1 | ⏳ |
| 3.4 | Buat `dashboard/agents.html` — 6 kartu + heatmap Chart.js | Builder | 45m | 3.1 | ⏳ |
| 3.5 | Update `dashboard/index.html` — redirect ke /overview | Builder | 5m | 3.1 | ⏳ |
| 3.6 | Test semua tab + API di browser | Pengawas | 30m | 3.3, 3.4 | ⏳ |

### Fase 4: Chat + Content + Schedule (22-24 Juli)

| # | Tugas | Pemilik | Est. | Bergantung Pada | Status |
|---|-------|---------|------|-----------------|--------|
| 4.1 | Buat `modules/hermes_bridge.py` — Hermes API via subprocess | Builder | 30m | 3.1 | ⏳ |
| 4.2 | Buat `dashboard/chat.html` — sidebar agent + area chat | Builder | 45m | 4.1 | ⏳ |
| 4.3 | Buat `dashboard/content.html` — daftar dokumen + filter | Builder | 30m | 1.2 | ⏳ |
| 4.4 | Buat `dashboard/schedule.html` — tabel cron + trigger/hapus | Builder | 30m | 3.1 | ⏳ |
| 4.5 | Buat `dashboard/docs.html` — daftar DOX + status badge | Builder | 20m | 3.1 | ⏳ |
| 4.6 | Test semua 3 tab + chat bridge | Pengawas | 30m | 4.2, 4.3, 4.4, 4.5 | ⏳ |

### Fase 5: Premium Features (25-28 Juli)

| # | Tugas | Pemilik | Est. | Bergantung Pada | Status |
|---|-------|---------|------|-----------------|--------|
| 5.1 | Buat `dashboard/office.html` — Three.js 3D towers | Builder | 1 jam | 3.1 | ⏳ |
| 5.2 | Fallback CSS towers jika Three.js gagal | Builder | 20m | 5.1 | ⏳ |
| 5.3 | Tambah token usage chart di Overview + Agents | Builder | 30m | 1.1 | ⏳ |
| 5.4 | Setup Tailscale + test remote access | Builder | 20m | - | ⏳ |
| 5.5 | Update listener server.py ke 0.0.0.0 | Builder | 5m | 5.4 | ⏳ |
| 5.6 | Test Office 3D + Tailscale dari mobile | Pengawas | 30m | 5.1, 5.4 | ⏳ |

### Fase 6: Docs & QA (17 Juli — ✅ Selesai)

| # | Tugas | Pemilik | Est. | Bergantung Pada | Status |
|---|-------|---------|------|-----------------|--------|
| 6.1 | Buat 6 dokumen foundation (PRD, TECHSPEC, UX, TIMELINE, TESTING, DEPLOY) | Arsitek | 45m | - | ✅ |
| 6.2 | Update AGENTS.md dengan arsitektur baru | Scribe | 15m | 6.1 | ✅ |
| 6.3 | Update RUNBOOK.md dengan komponen baru | Scribe | 15m | 6.1 | ✅ |
| 6.4 | Smoke test semua endpoint | Pengawas | 20m | 1.4 | ✅ |
| 6.5 | Final review + go-live approval | Afrizal | 15m | 6.1-6.4 | ⏳ |

---

## Dependensi

| Task | Bergantung Pada | Keterangan |
|------|----------------|------------|
| P2 (Topic Router) | P1 (Data Layer) | Topic router perlu log activity |
| P3 (Dashboard 2.0) | P1 (Data Layer) | Overview butuh data dari agent_log.db |
| P4 (Chat + Schedule) | P3 (Server refactor) | Semua tab butuh multi-tab routing |
| P5 (Office 3D) | P3 (Server refactor) | Butuh server yang sudah multi-tab |
| P5 (Token) | P1 (agent_log) | Token data dari agent_log.db |
| P6 (Docs & QA) | Semua fase | Quality gate setelah semua selesai |

---

## Checkpoint Risiko

| Checkpoint | Tanggal | Kriteria Go/No-Go |
|------------|---------|-------------------|
| **P1 Complete** | 17 Jul | agent_log.db bisa write + read. API return 200 ✅ |
| **P2 Complete** | 18 Jul | 6 topic Telegram ter-routing dengan benar |
| **P3 Complete** | 21 Jul | Overview + Agents tab menampilkan data live |
| **P4 Complete** | 24 Jul | Chat dari dashboard mendapat response agent |
| **P5 Complete** | 28 Jul | Office 3D render + Tailscale akses dari luar |
| **Beta Gate** | 1 Agt | Semua smoke test lulus, 0 regresi |
| **Launch Gate** | 7 Agt | Semua AC terpenuhi, dokumentasi final |

---

## Alokasi Waktu

| Sumber Daya | Fase | Total Jam |
|-------------|------|-----------|
| Builder (implementasi) | P1-P5 | 6 jam |
| Arsitek (desain) | P6 | 1 jam |
| Pengawas (review) | P3-P6 | 1,5 jam |
| Scribe (dokumentasi) | P6 | 0,5 jam |
| **Total Efektif** | | **~7 jam** |
| Buffer 20% | | ~1,5 jam |
| **Total dengan Buffer** | | **~8,5 jam** |

---

*Dokumen ini mengikuti template project-foundation skill.*

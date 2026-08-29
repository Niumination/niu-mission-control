# Rencana Detail — Phase 5 Frontend Visual

> **⚠️ SUPERSEDED** (2026-08-29)
>
> Dokumen ini merujuk pada arsitektur v2.x (FastAPI + vanilla dashboard) yang sudah **diganti** oleh v3.0.0 (Next.js + R3F + apex-ui).
>
> **Status**: Dokumen historis — disimpan untuk referensi, tidak lagi relevan dengan kode production saat ini.
> **Lihat**: `apex-ui/` (Next.js app), `docs/REFACTOR_COMPLETION_PLAN.md` (rencana refactor lengkap).

---

## Masalah Inti

1. **Backend v3 routers kosong** — hanya `system.py` yang punya logika. 11 router lain = skeleton.
2. **Frontend fetch dari `server.py` lama** — data yang tampil dari API lama, bukan v3.
3. **L3 Inspector tidak ada** — view baru yang belum dibuat.
4. **ADR-001 memutuskan vanilla HTML/CSS/JS** — bukan Vite/Svelte/TS. Jadi 5.1 & 5.2 diadaptasi.

---

## Fase 5A — Migrate Backend Logic (server.py → v3 routers)

> **Tujuan:** Semua API v3 berfungsi dengan data nyata dari SQLite, bukan dari file JSON/JSON lama.

### 5A.1 — Migrate tasks router
**Source:** `server.py` baris 563-708 (tasks_kanban, task_update, delegate_task)  
**Target:** `backend/app/routers/tasks.py` + `backend/app/services/task_service.py`  
**Logic:**
- `GET /api/mc/tasks` → query SQLite tasks table, return kanban format
- `POST /api/mc/task-update` → gunakan state_machine.transition_task()
- `POST /api/mc/delegate` → gunakan dispatcher.submit() + adapter.send()
- `GET /api/mc/logs` → query events table
- `GET /api/mc/errors` → count failed tasks

### 5A.2 — Migrate agents router
**Source:** `server.py` baris 550-561  
**Target:** `backend/app/routers/agents.py`  
**Logic:** Return agent fleet status (mock data sementara, karena agent data dari WS)

### 5A.3 — Migrate cost router
**Source:** `server.py` baris 1416-1450  
**Target:** `backend/app/routers/cost.py` + `backend/app/services/cost_tracker.py`  
**Logic:** Query cost table, return breakdown per agent/model/task

### 5A.4 — Migrate skills router
**Source:** `modules/skill_monitor.py` (sudah ada, dipanggil dari server.py)  
**Target:** `backend/app/routers/skills.py`  
**Logic:** Import skill_monitor functions, expose via v3 API

### 5A.5 — Migrate telegram + ecosystem
**Source:** `server.py` baris 880-920, 521-548  
**Target:** `backend/app/routers/telegram.py`, `ecosystem.py`

### 5A.6 — Test backend v3
**Test:** Semua endpoint v3 berfungsi dengan data nyata  
**Acceptance:** `curl localhost:5200/api/mc/tasks` return JSON tasks

---

## Fase 5B — Hubungkan Frontend ke v3 API

> **Tujuan:** Frontend fetch dari v3 backend (bukan server.py lama).

### 5B.1 — Update app.js fetch URLs
**Yang diubah:** Semua `fetch('/api/mc/...')` di app.js  
**Menjadi:** Tetap `/api/mc/...` (URL sama, tapi sekarang dilayani oleh v3 backend)

### 5B.2 — Update task card rendering
**Yang diubah:** `loadKanban()` di app.js  
**Menampilkan:** Task status state machine (queued → delegated → running → review → done/failed)  
**Termasuk:** Agent name, model, progress indicator, intervention buttons

### 5B.3 — Tambah cost display ke KPI cards
**Yang diubah:** KPI cards di dashboard section  
**Menambahkan:** "Cost Today" card dari `/api/mc/cost`

### 5B.4 — Tambah alert banner
**Yang diubah:** Dashboard section  
**Menambahkan:** Alert banner jika ada high-severity alerts dari `/api/mc/alerts`

---

## Fase 5C — L3 Inspector View (BARU)

> **Tujuan:** View baru untuk inspect task, trace timeline, cost breakdown, audit log.

### 5C.1 — Inspector section di HTML
**File:** `dashboard/build_unified.py`  
**Menambahkan:** Section `page-inspector` dengan:
- Task detail panel (id, title, status, agent, timeline)
- Cost breakdown table (per model, per task)
- Audit log table (actor, action, target, result, timestamp)
- Artifact explorer (file list + diff viewer)

### 5C.2 — Inspector JS functions
**File:** `dashboard/app.js`  
**Menambahkan:**
- `loadInspector(taskId)` — fetch task detail + cost + audit
- `renderTimeline(events)` — visual timeline dari events table
- `renderCostBreakdown(costs)` — tabel cost per agent/model
- `renderAuditLog(audit)` — tabel audit entries

### 5C.3 — Inspector CSS
**File:** `dashboard/styles.css`  
**Menambahkan:** Inspector-specific styles (timeline, tables, panels)

---

## Fase 5D — Verifikasi & Cleanup

### 5D.1 — Visual verification
- Buka dashboard → cek KPI cards, kanban, agent cards
- Buka task → cek inspector view
- Buka ⌘K → cek command palette

### 5D.2 — API verification
- Test semua `/api/mc/*` endpoint v3
- Pastikan tidak ada error di console

### 5D.3 — Regression test
- `pytest tests/` — semua pass
- `pytest backend/tests/` — semua pass

### 5D.4 — Commit + push

---

## Estimasi Waktu

| Fase | Waktu | Keterangan |
|------|-------|------------|
| 5A | 2-3 jam | Migrate 6 routers (tasks, agents, cost, skills, telegram, ecosystem) |
| 5B | 1-2 jam | Update frontend fetch + rendering |
| 5C | 2-3 jam | L3 Inspector view baru |
| 5D | 1 jam | Verifikasi + cleanup |
| **Total** | **6-9 jam** | |

---

## Yang TIDAK Diubah (sudah ada dan berfungsi)

- ✅ ORB 3D background
- ✅ 12 floating windows
- ✅ Agent cards (WebSocket)
- ✅ ⌘K Command Palette
- ✅ WCAG 2.1 AA (focus ring, kontras, keyboard)
- ✅ Glassmorphism theme

---

## Risk

| Risk | Mitigation |
|------|------------|
| Backend v3 tidak bisa handle data lama | Parallel: v3 serves dari SQLite, v2 serves dari JSON |
| Frontend break karena fetch berubah | Test manual setiap perubahan |
| L3 Inspector terlalu kompleks | Mulai dengan minimal viable (task detail + audit log dulu) |

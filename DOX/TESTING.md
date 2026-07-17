# Testing & QA: Niu-MissionControl Evolution

> **Status:** Final
> **Cakupan Target:** 100% smoke test untuk API endpoint, 90% coverage untuk tab dashboard
> **Diperbarui:** 17 Juli 2026

---

## 1. Kriteria Penerimaan

### Fitur: Topic Router Plugin

| # | Kriteria | Status |
|---|----------|--------|
| 1 | Pesan di topic #dev (ID 2) sampai ke Builder | ☐ |
| 2 | Pesan di topic #audit (ID 3) sampai ke Pengawas | ☐ |
| 3 | Pesan di topic #plan (ID 4) sampai ke Arsitek | ☐ |
| 4 | Pesan di topic #ops (ID 5) sampai ke Penjaga | ☐ |
| 5 | Pesan di topic #docs (ID 6) sampai ke Scribe | ☐ |
| 6 | Pesan di topic #social (ID 7) sampai ke Reach | ☐ |
| 7 | Pesan di #general (tanpa topic / ID 0/1) tetap ke orchestrator | ☐ |
| 8 | Agent menjawab di thread/topic yang sama | ☐ |
| 9 | Activity routing tercatat di agent_log.db | ☐ |

### Fitur: Activity Log Database

| # | Kriteria | Status |
|---|----------|--------|
| 1 | `agent_log.log()` insert berhasil | ☐ |
| 2 | `agent_log.get_recent(10)` return 10 baris terbaru | ☐ |
| 3 | `agent_log.get_stats()` return aggregate counts | ☐ |
| 4 | `agent_log.cleanup_old(30)` hapus data >30 hari | ☐ |
| 5 | Database auto-buat jika tidak ada | ☐ |
| 6 | WAL mode aktif untuk concurrent access | ☐ |

### Fitur: Dashboard 9 Tab

| # | Kriteria | Status |
|---|----------|--------|
| 1 | `/overview` menampilkan 4 widget (gateway, activity, system, token) | ☐ |
| 2 | `/agents` menampilkan 6 kartu agent + heatmap + pie chart | ☐ |
| 3 | `/office` menampilkan 3D towers atau CSS fallback | ✅ |
| 4 | `/chat` bisa kirim pesan ke agent dan dapat response | ✅ |
| 5 | `/tasks` menampilkan iframe kanban | ✅ |
| 6 | `/content` menampilkan daftar dokumen dengan filter | ✅ |
| 7 | `/schedule` menampilkan tabel cron dengan tombol Run/Hapus | ✅ |
| 8 | `/projects` menampilkan git health | ✅ |
| 9 | `/docs` menampilkan daftar DOX dengan status | ✅ |
| 10 | Navigasi tab berfungsi (klik link → tab tampil) | ✅ |

### Fitur: Server API

| # | Kriteria | Status |
|---|----------|--------|
| 1 | Semua endpoint existing return 200 (regression test) | ✅ |
| 2 | `GET /api/mc/activity` return JSON array | ✅ |
| 3 | `GET /api/mc/activity/stats` return JSON with counts | ✅ |
| 4 | `POST /api/mc/chat` dengan body valid return response | ✅ |
| 5 | `POST /api/mc/chat` dengan agent invalid return 400 | ✅ |
| 6 | `POST /api/mc/cron/run/{id}` return `{"status":"triggered"}` | ✅ |
| 7 | `GET /api/mc/tokens` return JSON dengan breakdown | ✅ |
| 8 | `GET /api/mc/content` return JSON array | ✅ |

### Fitur: Tailscale Remote Access

| # | Kriteria | Status |
|---|----------|--------|
| 1 | Dashboard bisa diakses via `http://<tailscale-ip>:5200` | ✅ |
| 2 | Semua tab berfungsi dari remote (sama seperti local) | ✅ |
| 3 | API endpoints return 200 dari remote | ✅ |

---

## 2. Skenario Pengujian

### Unit Test

| Skenario | Input | Harapan | Metode |
|----------|-------|---------|--------|
| agent_log.init() — DB baru | - | File `agent_log.db` terbuat | `ls data/agent_log.db` |
| agent_log.log() — insert | `agent="builder", task="test"` | 1 row di DB | `python3 -c "from modules.agent_log import *; log('builder','test'); print(get_stats())"` |
| agent_log.get_recent() — empty | limit=5 | List kosong `[]` | `curl http://localhost:5200/api/mc/activity` |
| content_db.init() — DB baru | - | File `content.db` terbuat | `ls data/content.db` |
| server.py — root redirect | `curl http://localhost:5200/` | 200, body contains "Overview" | `curl -s http://localhost:5200/ \| grep -c "Overview"` |
| server.py — 404 tab | `curl http://localhost:5200/tidak-ada` | 200, redirect ke /overview | `curl -s http://localhost:5200/tidak-ada` |

### Integration Test

| Skenario | Input | Harapan | Metode |
|----------|-------|---------|--------|
| **Full flow: Topic → DB → Dashboard** | Kirim task di #dev | Builder execute → log DB → activity muncul di Overview | Manual: Telegram + dashboard refresh |
| **Full flow: Chat → Hermes → Response** | POST chat ke /api/mc/chat | Response dari agent dalam < 10 detik | `time curl -X POST ...` |
| **Full flow: Schedule Trigger** | POST /api/mc/cron/run/{id} | Cron job berjalan, status update | `curl` + cek log |
| **Multi-tab navigation** | Klik semua 9 tab | Setiap tab render dengan benar | Manual browser |
| **Chart.js render** | Buka /agents | Heatmap + pie chart muncul, no console error | Browser DevTools console |
| **Tailscale remote** | Buka http://100.x.x.x:5200 | Semua fitur berfungsi | Remote browser |

### E2E Test

| Skenario | Input | Harapan | Metode |
|----------|-------|---------|--------|
| **Daily ops: cek dashboard + delegasi** | Buka /overview → /schedule → Telegram → #dev | Semua lancar | Manual |
| **Full remote workflow** | Tailscale → dashboard → chat agent → terima response | Dari luar rumah | Manual |
| **Recovery: server crash** | Kill server.py | launchd auto-restart < 30 detik | `kill` + `curl` |

---

## 3. Template Laporan Bug

```markdown
## Judul: [Ringkasan singkat masalah]

**Lingkungan:** Niu-MC / macOS / HermesAgent USB
**Fase:** P1/P2/P3/P4/P5/P6
**Severitas:** Critical / Major / Minor

**Langkah:**
1. Buka [tab/endpoint]
2. Klik [tombol]
3. Scroll ke [bagian]

**Harapan:** [Apa yang seharusnya terjadi]

**Aktual:** [Apa yang benar-benar terjadi]

**Console Error:**
```
[paste error di sini]
```

**Screenshot:** [link jika ada]
```

---

## 4. Strategi Regresi

| Area | Frekuensi | Metode | Otomatis? |
|------|-----------|--------|-----------|
| API endpoint existing | Setiap fase selesai | `curl` semua endpoint | ✅ Script shell |
| Dashboard tab render | Setiap tab baru | Manual browser | ❌ Manual |
| Activity logging | Setiap perubahan di agent_log.py | Unit test python | ✅ python3 -c |
| Topic routing | Setiap perubahan plugin | Manual Telegram | ❌ Manual |
| Hermes bridge | Setiap perubahan chat.py | Integration test | ⚡ Sebagian |

### Script Smoke Test Regresi

```bash
#!/bin/bash
# smoke_test.sh — Jalankan setelah setiap fase

echo "=== SMOKE TEST Niu-MC ==="
BASE="http://localhost:5200"

# Endpoint existing
for ep in aggregated system agents cron projects gateway; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/mc/$ep")
  echo "[$status] /api/mc/$ep"
done

# Endpoint baru
for ep in activity "activity/stats" tokens content; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/mc/$ep")
  echo "[$status] /api/mc/$ep"
done

# Tab
for tab in overview agents office chat tasks content schedule projects docs; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$tab")
  echo "[$status] /$tab"
done

echo "=== DONE ==="
```

---

## 5. Matriks Perangkat/Platform

| OS | Browser | Versi | Status |
|----|---------|-------|--------|
| macOS 14+ | Chrome | Latest | ✅ |
| macOS 14+ | Firefox | Latest | ✅ |
| macOS 14+ | Safari | Latest | ✅ |
| iOS 17+ | Safari (via Tailscale) | Latest | ⚠️ Perlu test |
| Windows | Chrome (via Tailscale) | Latest | ⚠️ Perlu test |
| Android | Chrome (via Tailscale) | Latest | ⚠️ Perlu test |

---

## 6. Budget Performa

| Metrik | Target | Alat Ukur |
|--------|--------|-----------|
| **Dashboard load time** (tab pertama) | < 2 detik | `curl -w %{time_total}` |
| **API response time** (endpoint utama) | < 500ms | `curl -w %{time_total}` |
| **Chat response time** (dari klik Send) | < 10 detik | `time curl -X POST` |
| **Tab switch time** (klik → render) | < 1 detik | Manual stopwatch |
| **Dashboard memory usage** | < 100MB | `ps -p <pid> -o rss=` |
| **agent_log.db size** (setelah 30 hari) | < 50MB | `ls -lh data/agent_log.db` |
| **Page score Lighthouse** | > 80 | Lighthouse CLI |

---

*Dokumen ini mengikuti template project-foundation skill.*

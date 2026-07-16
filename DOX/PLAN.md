# Niu-MissionControl — Master Plan

> **Version:** 1.0
> **Author:** Afrizal Munthe (Niumination)
> **Arsitektur:** 3-Tier Command System — Command · Intell · Execute
> **Inspirasi:** Hermes Mission Control (komputermechanic.com) — diadaptasi untuk Niumination Ecosystem
> **Prinsip:** Zero gap, zero assumption, every component has a failure mode and a recovery path.

---

## Daftar Isi

1. [System Architecture](#1-system-architecture)
2. [Asset Inventory](#2-asset-inventory)
3. [Implementation Phases](#3-implementation-phases)
4. [Operating Protocols](#4-operating-protocols)
5. [Delegation Matrix](#5-delegation-matrix)
6. [Failure Mode Analysis](#6-failure-mode-analysis)
7. [Verification Strategy](#7-verification-strategy)
8. [Risk Register](#8-risk-register)

---

## 1. System Architecture

### 1.1 Filosofi

Niu-MissionControl adalah **sistem komando tiga lapis** yang menyatukan seluruh ekosistem Niumination ke dalam satu titik kendali:

```
┌─────────────────────────────────────────────────────────────┐
│                   NIU-MISSIONCONTROL                        │
│                   Telegram Group                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LAYER 1: COMMAND (Telegram)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Orchestrator (Hermes Agent)                         │   │
│  │ Operating Rules · Label Routing · Approval Flow     │   │
│  │ [Plan] [Dev] [Research] [Docs] [Urgent] [Audit]     │   │
│  │ [Quick] [Maintenance]                                │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────┐          │
│  │                       │                       │          │
│  ▼                       ▼                       ▼          │
│  LAYER 2: INTELL    LAYER 1 (self)    LAYER 3: EXECUTE     │
│  ┌───────────────┐   ┌───────────┐   ┌──────────────────┐  │
│  │ Dashboard     │   │ Orchestr.│   │ Herdr Agents     │  │
│  │ · Kanban      │   │ Rules    │   │ · Builder        │  │
│  │ · System      │   │ Labels   │   │ · Pengawas       │  │
│  │ · Projects    │   │ Workflow │   │ · Arsitek        │  │
│  │ · Brain       │   │ Approval │   │ · Penjaga        │  │
│  └───────┬───────┘   └──────────┘   │ Niu-Flow (JCode) │  │
│          │                          │ Direct Exec      │  │
│          │                          └──────────────────┘  │
│          ▼                                                   │
│  DATA SOURCES: kanban.db · state.db · herdr.sock · git      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
User → Telegram → Orchestrator (Hermes)
  ├── [Plan]     → Show plan → wait approval → execute
  ├── [Dev]      → Delegate to Builder / Arsitek via herdr
  ├── [Research] → Delegate to Pengawas via herdr
  ├── [Docs]     → Orchestrator writes directly (Scribe mode)
  ├── [Audit]    → Route to Niu-Flow (JCode) or Pengawas
  ├── [Quick]    → Orchestrator executes directly in terminal
  ├── [Urgent]   → Orchestrator takes over, max priority
  └── [Maintenance] → Delegate to Penjaga via herdr
```

### 1.3 Component Ownership

| Komponen | Dimiliki Oleh | Lokasi |
|---|---|---|
| Telegram C2 | Hermes Agent | Telegram group |
| Dashboard (Kanban) | `niu-kanban-dash` | `projects/niu-kanban-dash/` |
| Dashboard (Widgets) | `niu-mission-control` | `projects/niu-mission-control/dashboard/` |
| CLI Orchestrator | `orchestrator` | `projects/orchestrator/` |
| Herdr Agents | 4 karakter | `characters/` (definisi), herdr runtime |
| Niu-Flow Bridge | `niu-flow` | `projects/Niu-Flow/` |
| Cron Automation | Hermes cron | `~/.hermes/cron/` |
| Brain OV | Obsidian | `brain/` |

---

## 2. Asset Inventory

### 2.1 Existing Assets (jangan rebuild)

| Asset | Status | Fungsi di MC |
|---|---|---|
| `projects/niu-kanban-dash/` | ✅ Complete | **Viewport utama** dashboard — kanban board visual |
| `projects/niu-dash-fullstack/` | 🟡 Active | Bisa jadi **tambahan** — 3D/theme dashboard opsional |
| `projects/orchestrator/` | 🟡 Phase 1 | Python CLI — **bisa diaktifkan ulang** untuk daily ops |
| `brain/` | ✅ Active | **Knowledge base** — AGENTS.md, BACKLOG.md, template |
| `characters/` (4 folder) | ✅ Defined | **Agent definitions** — siap di-spawn via herdr |
| Niu-Flow | ✅ Active | **JCode bridge** — deep audit pipeline |
| Cron (3 jobs) | ✅ Active | **Automation** — brain capture, checkpoint, audit |
| Gateway (launchd) | ✅ Active | **Model serving** — opencode-zen/big-pickle |

### 2.2 Missing Assets (perlu dibuat)

| Asset | Prioritas | Fungsi |
|---|---|---|
| DOX dokumentasi MC | P0 | AGENTS.md, ARCHITECTURE.md, RUNBOOK.md |
| Dashboard widgets | P1 | Agent status, cron health, project health |
| Scribe agent definition | P2 | Writing & documentation specialist |
| Reach agent definition | P2 | Outreach & komunikasi specialist |
| Health check cron | P2 | Auto-monitoring tiap 15 menit |
| Operating rules | P1 | Label taxonomy, approval flow, progress format |

### 2.3 Integration Points

```
niu-kanban-dash → baca kanban.db → tampil di dashboard
dashboard widget → baca state.db  → tampil status cron
dashboard widget → herdr status   → tampil agent health
dashboard widget → git status per repo → tampil project health
orchestrator CLI → jalanin task    → daily brief / vault
orchestrator CLI → bridge ke opencode → execute via herdr
herdr agent      → spawn opencode  → execute task
Niu-Flow         → bridge ke JCode → deep audit
cron             → script Python   → automation
```

---

## 3. Implementation Phases

### ⚡ Phase 1: Foundation (hari ini — 30 menit)

**Tujuan:** Project scaffold + DOX + operating rules aktif.

| # | Task | Durasi | Deliverable | Verifikasi |
|---|---|---|---|---|
| 1.1 | Buat direktori Niu-MissionControl | 2m | `projects/niu-mission-control/` | `ls` |
| 1.2 | Tulis AGENTS.md (identity + rules) | 10m | Dokumen identitas MC | `cat` |
| 1.3 | Tulis ARCHITECTURE.md | 5m | Diagram + layer description | file exist |
| 1.4 | Tulis RUNBOOK.md | 10m | Operasi harian + SOP | file exist |
| 1.5 | Symlink integrasi kanban dash | 2m | `modules/kanban-dash → ../niu-kanban-dash` | `ls -la` |
| 1.6 | Aktifkan operating rules di chat | 5m | Label taxonomy + approval flow | user konfirmasi |

**Edge cases:**
- Jika direktori udah ada → merge, jangan overwrite
- Jika kanban dash path berubah → update symlink
- Jika user tidak setuju rules → iterasi

**Failure recovery:**
- File write error → cek path + permission
- Symlink broken → target path not found → fix path

---

### 📊 Phase 2: Intell — Dashboard Integration (1 jam)

**Tujuan:** Satu dashboard yang aggregation dari semua data source.

| # | Task | Durasi | Deliverable | Verifikasi |
|---|---|---|---|---|
| 2.1 | Baca source code niu-kanban-dash | 5m | Pahami API endpoints | `cat server.js` |
| 2.2 | Test run kanban dash server | 3m | Port 5199 running | `curl localhost:5199` |
| 2.3 | Buat widget: herdr agent status | 15m | Script baca herdr socket → output JSON | `python get-agents.py` |
| 2.4 | Buat widget: cron job health | 10m | Script baca state.db → status cron | `python get-cron.py` |
| 2.5 | Buat widget: project git health | 15m | Script git status per project dir | `python get-git.py` |
| 2.6 | Buat widget: gateway status | 5m | Cek launchd + gateway state | `python get-gateway.py` |
| 2.7 | Buat index.html unification | 15m | 4 widget + embed kanban iframe | buka di browser |
| 2.8 | Aggregator script (cron feed) | 10m | `aggregator.sh` jalan tiap 5m | `bash aggregator.sh` |

**Edge cases:**
- Kanban dash server mati → widget tampilkan "offline", jangan hard crash
- Herdr socket tidak ada (ExFAT) → tampilkan error message + symlink fix instruction
- Git repo belum di-clone → skip, tampilkan "not cloned"
- State.db sedang di-lock → retry 3x, lalu timeout gracefully
- Dashboard widgets fetch error → fallback ke cached data

**Failure recovery:**
- Widget script exit code != 0 → tampilkan placeholder "error: [pesan]"
- Server.js crash → `process list` → `restart` command in RUNBOOK
- Port 5199 conflict → check `lsof -i :5199` → kill or change port

---

### 🤖 Phase 3: Execute — Agent Fleet Activation (30 menit)

**Tujuan:** Herdr agents aktif dan siap eksekusi.

| # | Task | Durasi | Deliverable | Verifikasi |
|---|---|---|---|---|
| 3.1 | Cek herdr socket | 2m | Status herdr server | `herdr status` |
| 3.2 | Spawn Builder (Dev) | 3m | Agent running | `herdr agent list` |
| 3.3 | Spawn Pengawas (Scout) | 3m | Agent running | `herdr agent list` |
| 3.4 | Spawn Arsitek | 3m | Agent running | `herdr agent list` |
| 3.5 | Spawn Penjaga | 3m | Agent running | `herdr agent list` |
| 3.6 | Kirim definisi karakter | 5m | Masing-masing agent tau perannya | `agent send` + verify |
| 3.7 | Test: kirim task ke Builder | 3m | Agent eksekusi | output diterima |
| 3.8 | Test: kirim task ke Pengawas | 3m | Agent review | output diterima |

**Edge cases:**
- Herdr socket broken (ExFAT) → RUNBOOK punya fix: symlink
- Nama agent already taken → close pane lama dulu
- Agent spawn tapi langsung exit → cek opencode binary path
- Agent stuck di "working" forever → timeout + kill + restart
- Semua agent pake opencode → concurrent = parallel, resource aman

**Failure recovery:**
- Socket error → `ln -sf /Users/zaryu/.config/herdr/herdr.sock $HOME/.config/herdr/herdr.sock`
- Agent hang → `herdr agent kill <name>` → `herdr agent start <name>`
- Opencode not found → `which opencode` → install / fix path

---

### 📐 Phase 4: Orchestrator — Rules & Protocols (20 menit)

**Tujuan:** Operating rules formal + routing taxonomy aktif.

| # | Task | Durasi | Deliverable | Verifikasi |
|---|---|---|---|---|
| 4.1 | Definisikan label taxonomy di AGENTS.md | 5m | 8 labels dengan deskripsi | dokumen |
| 4.2 | Definisikan approval flow | 3m | Multi-step task protocol | dokumen |
| 4.3 | Definisikan progress reporting | 3m | Format `[Agent]: Step X/Y` | dokumen |
| 4.4 | Definisikan delegation rules | 3m | Kapan pake herdr vs direct vs Niu-Flow | dokumen |
| 4.5 | Definisikan failure reporting | 2m | "Never fabricate" protocol | dokumen |
| 4.6 | Save ke memory | 2m | Operating rules persisted | memory recall |

**Edge cases:**
- User lupa pake label → orchestrator bantu kategorikan
- User kirim urgent tanpa label → orchestrator tanya prioritas
- Multi-step task gagal di tengah → orchestrator report + rollback plan
- Task butuh approval tapi user offline → queue + notify saat online

---

### 🔄 Phase 5: Automation & Alerting (30 menit)

**Tujuan:** Sistem auto-monitoring + alert.

| # | Task | Durasi | Deliverable | Verifikasi |
|---|---|---|---|---|
| 5.1 | Buat health check script | 10m | Cek: gateway, herdr, kanban DB, disk | `bash health.sh` |
| 5.2 | Cron health check tiap 15 menit | 3m | Cron job ID | `cron list` |
| 5.3 | Buat daily briefing script | 10m | Summary: project statuses | `bash daily-brief.sh` |
| 5.4 | Cron daily briefing tiap 08:00 | 3m | Cron job ID | `cron list` |
| 5.5 | Failure alert pipeline | 5m | Jika health check fail → kirim ke Telegram | test with forced error |

**Edge cases:**
- Health check gagal sementara (network blip) → jangan flood, cooldown 5 menit
- Disk >90% → alert, jangan tunggu full
- Cron job missed → state.db punya track record, report di briefing
- Multiple failures → group into one alert, jangan spam

---

### 🎯 Phase 6: Character Expansion (30 menit)

**Tujuan:** Lengkapi fleet dengan agents yang belum ada.

| # | Task | Durasi | Deliverable | Verifikasi |
|---|---|---|---|---|
| 6.1 | Buat definisi karakter Scribe (Docs) | 10m | AGENTS.md + prompt | file exist |
| 6.2 | Buat definisi karakter Reach (Komunikasi) | 10m | AGENTS.md + prompt | file exist |
| 6.3 | Spawn Scribe di herdr | 3m | Agent running | `herdr agent list` |
| 6.4 | Spawn Reach di herdr | 3m | Agent running | `herdr agent list` |
| 6.5 | Update dashboard widget untuk 6 agents | 5m | Widget menunjukkan semua agent | browser refresh |

**Edge cases:**
- Karakter Scribe butuh akses ke Obsidian vault → path harus benar
- Reach butuh akses ke Telegram/platform → API key management
- 6 agents concurrent → resource check (RAM, CPU)

---

## 4. Operating Protocols

### 4.1 Label Taxonomy

Setiap task di chat WAJIB punya label. Jika user tidak kasih label, Orchestrator akan mendeteksi dan menambahkan.

| Label | Warna | Penggunaan | Contoh |
|---|---|---|---|
| `[Plan]` | Cyan | Sebelum eksekusi task multi-step | "[Plan] Mau refactor dashboard routing" |
| `[Dev]` | Green | Coding, implementation, bug fix | "[Dev] Buat komponen X" |
| `[Research]` | Purple | Intel, analysis, deep dive | "[Research] Cek kompetitor A" |
| `[Docs]` | Gray | Dokumentasi, catatan, writing | "[Docs] Update README proyek B" |
| `[Urgent]` | Red | Prioritas maksimum, interupsi | "[Urgent] Production down!" |
| `[Audit]` | Orange | Code review, quality check | "[Audit] Review PR dashboard" |
| `[Quick]` | Green soft | Satu langkah, langsung gas | "[Quick] Hapus file sampah" |
| `[Maintenance]` | Purple soft | Ops, automation, cron | "[Maintenance] Update cron schedule" |

### 4.2 Approval Flow

```
User: "[Plan] Refactor auth module"
Orchestrator: Menampilkan plan:
  1. Audit kode auth saat ini (Pengawas)
  2. Buat arsitektur baru (Arsitek)
  3. Implementasi (Builder)
  4. Review hasil (Pengawas)
  5. Merge
  Approve? ✅ / 🔧
User: "Gas"
Orchestrator: Langsung execute step 1
```

### 4.3 Progress Reporting

```
[Pengawas]: Step 1 of 5 — mengaudit auth module...
[Pengawas]: Ditemukan 3 celah keamanan
[Arsitek]: Step 2 of 5 — mendesain ulang auth flow...
[Arsitek]: Selesai, 2 file baru
```

**Aturan:** Tidak boleh diam >60 detik pada active task. Jika butuh waktu lama, kirim update "masih proses...".

### 4.4 Delegasi Rules

| Tipe Task | Delegasi Ke | Alasan |
|---|---|---|
| Bug fix, implementasi fitur | **Builder** via herdr | Cepat, praktis, gas dulu |
| Code review, security audit | **Pengawas** via herdr | Teliti, kritikal |
| System design, arsitektur | **Arsitek** via herdr | Visioner, struktural |
| Monitoring, cron, ops | **Penjaga** via herdr | Auto-pilot, zero maintenance |
| Deep code audit (>1000 lines) | **Niu-Flow** via JCode | JCode lebih powerful |
| Quick operation (1 cmd) | **Direct terminal** | Lebih cepat tanpa overhead |
| Research, dokumentasi | **Orchestrator (saya)** | Butuh reasoning + konteks |
| Penulisan dokumen | **Orchestrator (saya)** | Scribe mode — konsistensi style |

### 4.5 Aturan Komunikasi (adopsi dari tutorial)

```
1. PROGRESS
   - Format: [Agent]: Step X of Y — [what you're doing now]
   - Never >60s silent on active task.

2. APPROVAL
   - Show plan before acting on multi-step tasks.

3. COMMUNICATION
   - Keep responses short and clear — no padding.
   - Options: 1, 2, 3.
   - Lead with the decision user needs to make, not background.
   - BANNED: "Great question," "Certainly," "Absolutely."

4. DELEGATION
   - State which agent + why in one line.
   - NEVER fabricate results. If failed, say so plainly.

5. FAILURE
   - If a tool call fails → report immediately + alternative suggestion.
   - If agent returns bad result → verify, don't forward blindly.
```

---

## 5. Delegation Matrix

```
┌─────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│                 │Builder   │Pengawas  │Arsitek   │Penjaga   │Niu-Flow  │Direct    │
├─────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Feature impl    │ ✅ Prime │          │          │          │          │          │
│ Bug fix         │ ✅ Prime │          │          │          │          │ 🔧 Quick │
│ Code review     │          │ ✅ Prime │          │          │          │          │
│ Security audit  │          │ ✅ Prime │          │          │ 🔧 Deep  │          │
│ System design   │          │          │ ✅ Prime │          │          │          │
│ Tech decisions  │          │          │ ✅ Prime │          │          │          │
│ Monitoring      │          │          │          │ ✅ Prime │          │          │
│ Cron management │          │          │          │ ✅ Prime │          │          │
│ Full re-write   │          │          │          │          │ ✅ Prime │          │
│ Heavy refactor  │ 🔧 Exec  │ 🔧 Review│ 🔧 Plan  │          │ ✅ Prime │          │
│ Quick command   │          │          │          │          │          │ ✅ Prime │
│ Research        │          │ ✅ Prime │          │          │          │          │
│ Documentation   │          │          │          │          │          │ ✅ Saya  │
│ Deployment      │ 🔧 Exec  │ 🔧 Verify│          │ ✅ Cron  │          │          │
│ Data migration  │ 🔧 Exec  │          │ 🔧 Plan  │          │ 🔧 Audit │          │
└─────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

Legend: ✅ Prime = default delegate · 🔧 = supporting role
```

---

## 6. Failure Mode Analysis

### 6.1 Failure Mode Catalog

| Komponen | Failure Mode | Dampak | Probability | Severity | Recovery |
|---|---|---|---|---|---|
| **Telegram API** | Down/rate limit | Command center offline | Low | Critical | Wait. Messages queue di server Telegram |
| **Hermes Agent** | Crash / OOM | Saya offline | Medium | Critical | Auto-restart oleh systemd/launchd? Perlu dicek |
| **Herdr Socket** | ExFAT broken | Agents unreachable | High | High | Symlink fix (`RUNBOOK.md`) |
| **Herdr Agent** | Hang / stuck | Task tidak selesai | Medium | Medium | `herdr agent kill` → restart |
| **Kanban DB** | Locked | Dashboard 500 | Low | Medium | Kill stale sqlite3 procs |
| **Gateway** | Crash | No model access | Medium | Critical | launchd auto-restart |
| **Niu-Flow** | JCode not found | Deep audit unavailable | Low | Low | Fallback ke Pengawas |
| **Dashboard Server** | Crash | UI offline | Medium | Medium | Restart command di RUNBOOK |
| **Cron** | Missed run | Automation gap | Low | Low | Next run catches up |
| **Disk Full** | No space | Everything fails | Low | Critical | Alert + cleanup |
| **macOS Sleep** | All processes pause | Everything offline | High | Critical | `caffeinate` / prevent sleep |
| **Character Definition Lost** | File deleted | Agent personality lost | Low | High | Git restore |
| **Git Push Failed** | Network error | Changes not pushed | Medium | Low | Retry manual |

### 6.2 Mitigation Matrix

| Failure | Mitigation | Implementasi Di |
|---|---|---|
| ExFAT socket | Symlink fix di RUNBOOK | Phase 1 |
| Agent hang | Timeout + kill script | Phase 3 |
| Dashboard crash | Auto-restart cron check | Phase 5 |
| Disk full | Alert at 85% | Phase 5 |
| macOS sleep | `caffeinate` daemon | Phase 5 |
| No orchestration SOP | RUNBOOK + operating rules | Phase 1 + 4 |

### 6.3 Critical Path Analysis

**Critical path untuk operasi harian:**
```
Telegram → Hermes Agent → (pilih jalur)
  ├── Gateway (model) → WAJIB HIDUP
  ├── Herdr socket → WAJIB TERKONEKSI
  └── Filesystem (ExFAT) → WAJIB TERMOUNT
```

**Single point of failure:**
1. **Hermes Agent (saya)** — jika saya crash, tidak ada redundancy. Mitigasi: auto-restart.
2. **ExFAT USB** — HermesAgent USB disconnect = total loss. Mitigasi: backup config ke APFS.
3. **Gateway (model)** — jika opencode-zen down, fallback chain harus siap.

---

## 7. Verification Strategy

Setiap fase memiliki verification gate — task tidak dianggap selesai sampai terverifikasi.

### 7.1 Smoke Tests

| Test | Command | Expected |
|---|---|---|
| Dashboard loads | `curl http://localhost:5199` | 200 OK |
| Kanban API responds | `curl http://localhost:5199/api/tasks` | JSON array |
| Herdr socket | `herdr status` | Socket connected |
| Agent list | `herdr agent list` | 4+ agents |
| Gateway | `curl localhost:8080/health` (or hermes doctor) | Running |
| Widget data | `python dashboard/get-agents.py` | Valid JSON |
| Cron job | `cronjob action=list` | All 3 jobs enabled |

### 7.2 Integration Tests

| Test | Steps |
|---|---|
| Dashboard → kanban | Buka browser, kanban board tampil |
| Widget → herdr | Widget menampilkan status agents |
| Widget → cron | Widget menampilkan cron schedule |
| Orchestrator → herdr | Kirim task lewat Telegram → agent execute |
| Niu-Flow → JCode | Trigger audit → hasil kembali |

### 7.3 Chaos Tests

| Test | Procedure | Expected |
|---|---|---|
| Kill dashboard server | `kill <pid>` → health check trigger → auto-restart | Dashboard kembali dalam 1 menit |
| Herdr socket broken | Unlink socket → runbook symlink fix | Agents kembali online |
| Gateway crash | `launchctl kickstart` | Gateway restart dalam 5 detik |

---

## 8. Risk Register

| ID | Risk | Impact | Probability | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | ExFAT HermesAgent USB rusak/copot | Total system failure | Low | Backup config ke APFS `/Users/zaryu/.hermes-portable/` | User |
| R2 | macOS sleep saat background task | Task interrupted | High | Caffeinate / `pmset noidle` | System |
| R3 | OpenCode/Model provider API change | Agent tidak bisa connect | Medium | Fallback chain di gateway config | Dev |
| R4 | Dashboard widget data stale | Wrong decisions | Medium | Auto-refresh 30s + timestamp | Dev |
| R5 | Herdr agent consume too much RAM | System slow | Medium | Max 2 concurrent agents | Dev |
| R6 | Kanban DB schema change | Dashboard breaks | Low | Version API, test after update | Dev |
| R7 | User lupa operating rules | Chaos | Medium | Orchestrator bantu kategorikan | Agent |

---

## Appendices

### A. Command Reference

```bash
# Agent management
herdr agent list                          # Status semua agent
herdr agent send <name> "<instruction>"   # Kirim task
herdr agent kill <name>                   # Force stop

# Dashboard
cd projects/niu-kanban-dash && pnpm start  # Start kanban server (port 5199)
cd projects/niu-mission-control && open dashboard/index.html  # MC dashboard

# Health
bash scripts/health.sh                    # Full system check
cronjob action=list                        # Cron status

# Gateway
launchctl list | grep hermes              # Gateway status
launchctl kickstart -kp gui/$(id -u)/ai.hermes.gateway  # Restart gateway
```

### B. File Tree

```
Niu-MissionControl/
├── DOX/
│   ├── AGENTS.md              # Identity + operating rules (THIS)
│   ├── ARCHITECTURE.md        # System architecture
│   ├── RUNBOOK.md             # Daily operations SOP
│   └── PLAN.md                # Implementation plan (this file)
├── dashboard/                 # MC-specific dashboard widgets
│   ├── index.html             # Unification page
│   ├── js/
│   │   ├── agents.js          # Herdr agent status widget
│   │   ├── cron.js            # Cron health widget
│   │   ├── projects.js        # Project git health widget
│   │   └── gateway.js         # Gateway status widget
│   └── css/
│       └── mc.css             # MC dashboard styles
├── modules/                   # Symlinks to existing projects
│   ├── kanban-dash -> ../../projects/niu-kanban-dash/
│   └── orchestrator -> ../../projects/orchestrator/
├── scripts/                   # Automation scripts
│   ├── health.sh              # Health check (di-cron tiap 15m)
│   ├── aggregator.sh          # Aggregate all data sources
│   ├── get-agents.py          # Herdr agent → JSON
│   ├── get-cron.py            # Cron status → JSON
│   └── get-git.py             # Project health → JSON
└── ARCHITECTURE.html          # Visual diagram (SVG)
```

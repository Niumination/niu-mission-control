# UserFlow & Wireframe: Niu-MissionControl Evolution

> **Status:** Final
> **Diperbarui:** 17 Juli 2026
> **Dokumen Terkait:** PRD.md, TECHSPEC.md

---

## 1. Perjalanan Pengguna

### Perjalanan 1: Pantau Dashboard Harian

1. Pengguna membuka `http://localhost:5200` (atau via Tailscale)
2. Sistem redirect ke `/overview`
3. Pengguna melihat: status gateway ✅, 5 aktivitas terakhir, penggunaan CPU/RAM/Disk, breakdown token
4. Pengguna klik tab **Agents** → melihat 6 kartu agent + heatmap aktivitas 7 hari
5. Pengguna klik tab **Schedule** → melihat cron jobs + next run
6. **Hasil:** Gambaran lengkap status sistem dalam < 30 detik

### Perjalanan 2: Delegasi Task via Telegram Topic

1. Pengguna buka Telegram → Niu-MissionControl group
2. Pilih topic **#dev** (Topic ID 2)
3. Ketik: `[Dev] Buat endpoint user API`
4. **Topic Router Plugin** deteksi Topic ID = 2 → route ke **Builder**
5. Builder respon di thread yang sama: "Oke, saya kerjakan..."
6. Activity tercatat di `agent_log.db`
7. Pengguna buka Dashboard → tab Overview → Recent Activity menampilkan entry baru
8. **Hasil:** Task ter-delegasi ke agent yang tepat, tercatat, dan termonitor

### Perjalanan 3: Chat Agent dari Dashboard

1. Pengguna di dashboard → klik tab **Chat**
2. Sidebar kiri: 6 tombol agent (🏗️ Builder, 🔍 Pengawas, dll)
3. Klik **🏗️ Builder**
4. Area chat muncul. Ketik: `Cek error di log backend`
5. Klik Send → `POST /api/mc/chat {agent: "builder", message: "Cek error..."}`
6. Server bridge ke Hermes → proses → response balik
7. Response tampil di area chat
8. Activity tercatat di `agent_log.db`
9. **Hasil:** Chat agent tanpa perlu buka Telegram

### Perjalanan 4: Lihat Dokumen dari Scribe

1. Scribe selesai menulis dokumen: `data/contents/scribe/panduan-api-splp.md`
2. Metadata dicatat di `content.db`
3. Pengguna di dashboard → tab **Content**
4. Filter dropdown: pilih **Scribe**
5. Lihat daftar dokumen Scribe: judul, word count, tanggal
6. Klik dokumen → isi markdown tampil
7. **Hasil:** Semua dokumen agent terorganisir per folder

### Perjalanan 5: Trigger Cron Manual

1. Pengguna di dashboard → tab **Schedule**
2. Lihat tabel cron: nama, schedule, last run, next run, status
3. Ada cron health check yang jadwalnya terlewat
4. Klik tombol **▶ Run Now** → `POST /api/mc/cron/run/{id}`
5. Status berubah jadi "running..." lalu "success"
6. **Hasil:** Cron bisa di-trigger manual tanpa CLI

### Perjalanan 6: Akses dari Luar via Tailscale

1. Pengguna di luar rumah (mobile / laptop kerja)
2. Buka Terminal → `tailscale status` (pastikan connected)
3. Buka browser → `http://100.x.x.x:5200`
4. Dashboard tampil sama seperti di localhost
5. **Hasil:** Akses penuh dari mana saja

---

## 2. Wireframe

### 2.1 Navigasi Tab (Semua Halaman)

```
┌─────────────────────────────────────────────────────────────────────┐
│  🎮 Niu-MissionControl                                        WIB  |
├────┬──────┬──────┬────┬───────┬────────┬─────────┬────────┬──────┤
│ 📊 │ 🤖  │ 🏙️ │ 💬│ 📋   │ 📄    │ ⏰     │ 📁    │ 📖 │
│Over │Agent │Office│Chat│ Tasks│Content │Schedule│Project│ Docs│
│view │      │      │    │      │        │        │ s     │     │
├────┴──────┴──────┴────┴───────┴────────┴─────────┴────────┴──────┤
│                                                                     │
│                   [CONTENT AREA — per tab]                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Overview Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📊 OVERVIEW                                                   85% 🔵│
├───────────────┬──────────────────────┬──────────────────────────────┤
│  🌐 GATEWAY   │  🤖 RECENT ACTIVITY  │  📊 SYSTEM                   │
│  Status: ✅   │  ┌─────────────────┐ │  CPU ████████░░ 82%         │
│  Model: bp    │  │ 14:30 Builder   │ │  RAM ██████░░░░ 62%         │
│  Uptime: 12h  │  │       impl fitur│ │  Disk ████░░░░░░ 42%        │
│               │  │ 14:25 Pengawas  │ │                              │
│  💰 TOKEN     │  │       review #42│ │  📊 WORKLOAD                 │
│  In: 52.000   │  │ 14:20 Arsitek   │ │  ┌────┐                      │
│  Out: 28.000  │  │       design db │ │  │ ██ │ Builder: 15         │
│  Total: 80K   │  └─────────────────┘ │  │ ██ │ Pengawas: 10        │
│               │                      │  │ ██ │ Arsitek: 8          │
└───────────────┴──────────────────────┴──────────────────────────────┘
```

### 2.3 Agents Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🤖 AGENT FLEET                                           6 agents   │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐            │
│ │ 🏗️ BUILDER    │ │ 🔍 PENGAWAS   │ │ 📐 ARSITEK     │            │
│ │ Status: 🟢 Idle│ │ Status: 🟡 Work│ │ Status: 🟢 Idle│            │
│ │ Last: impl X   │ │ Last: review  │ │ Last: design  │            │
│ │ ✅ 93% success  │ │ ✅ 97% success │ │ ✅ 100% success│            │
│ │ Model: gemini   │ │ Model: claude │ │ Model: gemini  │            │
│ └────────────────┘ └────────────────┘ └────────────────┘            │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐            │
│ │ 🛡️ PENJAGA    │ │ ✍️ SCRIBE     │ │ 📡 REACH       │            │
│ │ Status: 🟢 Idle│ │ Status: 🟢 Idle│ │ Status: 🟢 Idle│            │
│ │ Last: health   │ │ Last: write   │ │ Last: post     │            │
│ │ ✅ 91% success  │ │ ✅ 100% success│ │ ✅ 100% success│            │
│ └────────────────┘ └────────────────┘ └────────────────┘            │
├──────────────────────────────────────────────────────────────────────┤
│ 📊 Activity Heatmap (7 hari)                                        │
│     Sen  Sel  Rab  Kam  Jum  Sab  Min                               │
│ 00  ░░   ░░   ░░   ░░   ░░   ░░   ░░                               │
│ 06  ░░   ░░   ██   ██   ░░   ░░   ░░    ██ = 5+ tasks              │
│ 12  ██   ██   ██   ██   ██   ░░   ░░    ▓▓ = 2-4 tasks              │
│ 18  ██   ▓▓   ██   ▓▓   ██   ░░   ░░    ░░ = 0-1 tasks              │
├──────────────────────────────────────────────────────────────────────┤
│ 📊 Task Distribution                🤖 Model Usage                  │
│ ┌────────────┐                     ┌────────────┐                   │
│ │ Builder  ██│ 36%                │ Gemini  ██│ 55%                 │
│ │ Pengawas █│ 24%                 │ Claude  ██│ 35%                 │
│ │ Arsitek  █│ 19%                 │ Custom  ░░│ 10%                 │
│ └────────────┘                     └────────────┘                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.4 Chat Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ 💬 CHAT                                                    Builder  │
├──────────────────────┬───────────────────────────────────────────────┤
│  AGENTS              │  💬 Chat — Builder                            │
│                      │                                               │
│  🏗️ Builder ◄       │  ┌───────────────────────────────────────┐   │
│  🔍 Pengawas        │  │ You: Tolong cek error di log backend  │   │
│  📐 Arsitek         │  │ 14:30                                 │   │
│  🛡️ Penjaga        │  └───────────────────────────────────────┘   │
│  ✍️ Scribe          │  ┌───────────────────────────────────────┐   │
│  📡 Reach           │  │ Builder: Sudah saya cek. Ada 3 error │   │
│                      │  │ di service/auth.py line 42, 87, 103. │   │
│                      │  │ 14:31                               │   │
│                      │  └───────────────────────────────────────┘   │
│                      │                                               │
│                      │  ════════════════════════════════════════    │
│                      │  [ Input chat...              ] [Kirim]     │
└──────────────────────┴───────────────────────────────────────────────┘
```

### 2.5 Schedule Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⏰ CRON SCHEDULE                                           3 jobs   │
├──────────────────────────────────────────────────────────────────────┤
│ ╔══════════════════════════════════════════════════════════════════╗ │
│ ║ Job           │ Schedule     │ Last Run        │ Next Run      ║ │
│ ║───────────────┼──────────────┼─────────────────┼───────────────║ │
│ ║ 🧠 Capture    │ 0 21 * * *  │ 16 Jul 21:00 ✅ │ 17 Jul 21:00 ║ │
│ ║   Brain       │              │                 │               ║ │
│ ║───────────────┼──────────────┼─────────────────┼───────────────║ │
│ ║ ✅ Health     │ */15 * * * *│ 17 Jul 14:30 ✅ │ 17 Jul 14:45 ║ │
│ ║   Check       │              │                 │               ║ │
│ ║───────────────┼──────────────┼─────────────────┼───────────────║ │
│ ║ 📊 Dashboard  │ 0 8 * * *   │ 17 Jul 08:00 ❌ │ 18 Jul 08:00 ║ │
│ ║   Briefing    │              │                 │               ║ │
│ ╚══════════════════════════════════════════════════════════════════╝ │
│                                [▶ Run Now] [🗑 Delete]              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Pola Interaksi

| Elemen | Pemicu | Respon |
|--------|--------|--------|
| **Tab nav** | Klik | Ganti konten area (AJAX, tanpa reload) |
| **Tombol Run Now** | Klik | `POST /api/mc/cron/run/{id}` → status "running..." → "success"/"failed" |
| **Kirim Chat** | Klik tombol / Enter | `POST /api/mc/chat` → spinner → response |
| **Pilih agent Chat** | Klik sidebar | Ganti area chat + riwayat |
| **Filter Content** | Pilih dropdown | Filter list dokumen by agent |
| **Refresh** | Klik ⟳ | Poll semua widget |
| **3D Office** | Drag mouse | Orbit kamera (Three.js orbit controls) |
| **Health Ring** | Hover | Tooltip detail |

---

## 4. Kasus Pinggiran

| Kasus | Perilaku yang Diharapkan |
|-------|--------------------------|
| **Empty state** — belum ada activity | "Belum ada aktivitas. Delegasikan task pertama Anda!" |
| **Empty state** — belum ada dokumen | "Belum ada dokumen. Minta agent menulis!" |
| **Error state** — API activity error | "Gagal memuat aktivitas. Coba refresh." |
| **Error state** — gateway down | "Gateway sedang offline. Cek status di Overview." |
| **Loading state** | Skeleton animation / spinner |
| **Slow network** (Tailscale jauh) | Timeout setelah 10 detik, tampilkan error |
| **Agent offline** di Chat tab | "Agent tidak tersedia. Coba via Telegram." |
| **Chart.js CDN offline** | Tabel statis sebagai fallback |
| **Three.js CDN offline** | CSS towers sebagai fallback |
| **Browser tua** (tidak support ES6) | Polyfill atau fallback halaman sederhana |
| **Cron job gagal trigger** | "Gagal menjalankan cron. Coba manual via terminal." |
| **agent_log.db corrupt** | Auto-create ulang, log lama hilang |
| **Data content terlalu banyak** | Pagination (20 per halaman) + search |

---

## 5. Pertimbangan Platform

| Aspek | Detail |
|-------|--------|
| **Mobile (Tailscale)** | Dashboard responsive dengan CSS grid. Tab nav jadi hamburger menu di < 768px |
| **Dark mode** | ✅ Seluruh dashboard sudah dark theme (`#020617` background) |
| **Navigasi keyboard** | Tab order: nav → content. Shortcut: `Ctrl+1` sampai `Ctrl+9` untuk tab |
| **Screen reader** | ARIA labels di navigasi tab dan tombol interaktif |
| **Touch targets** | Tombol minimal 44×44px untuk mobile |

---

*Dokumen ini mengikuti template project-foundation skill.*

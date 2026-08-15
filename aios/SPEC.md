# AIOS — Integration Spec (v4.0 Final)

**Source of truth untuk membangun `aios/`. Dibaca oleh SEMUA agent.**
**Tanggal:** 2026-08-14 · **Status:** BUILD

---

## 1. Tujuan

Gabungkan kekuatan 3 sumber menjadi **satu Personal AI OS Dashboard**:

| Sumber | Path | Yang diambil |
|--------|------|--------------|
| Prototype A/B/C | `prototypes/01-holographic-core.html`, `02-thread-orchestrator.html`, `03-ai-os-shell.html` | Layout shell, data live API pattern, view-switch, 5-thread konsep |
| Reference v3.1 Final | `references/hermes-dashboard-v3-final.html` | **Design system utama** (theme orange/amber, custom cursor, glass, thread cards, agent cards, dock, waveform, tooltips, toggles) |
| Reference Face Hologram | `references/hermes-face-hologram-final.html` | Digital human + **7-phase face hologram cycle** (particle converge → wireframe → biometric scan → dissolve) |

**Wajib membaca file referensi di atas sebelum menulis kode** — SALIN pola CSS/JS yang relevan, jangan mengarang ulang dari ingatan.

---

## 2. Struktur File Target

```
services/niu-mission-control/aios/
├── index.html          # Agent 1: shell + SEMUA CSS (theme, layout, komponen)
├── core.js             # Agent 2: holo canvas 2D + digital human + face phases
├── orchestrator.js     # Agent 3: data live (API fetch + WS) + render threads/agents/logs/activity
└── multimodal.js       # Agent 3: sound (Web Audio), voice (Web Speech), gesture (MediaPipe lazy)
```

---

## 3. Kontrak DOM (ID wajib — semua file harus sinkron)

### Header
- `#cR` custom cursor ring · `#cD` custom cursor dot
- `#clock` waktu HH:MM:SS · `#hdrLat` latency ms · `#healthPct` health %
- `#tglSfx` toggle sound (class `.on` = aktif) · `#tglGest` toggle gesture

### Stats (center atas)
- `#svT` tokens/s · `#svA` agents aktif (n/N) · `#svL` avg latency · `#svS` sys load %

### Thread Orchestrator (kiri)
- `#threadList` container thread cards. Setiap card: `[data-thread-id]`, `.tc-nm` nama, `.tc-id` ID mono, `.pill` status, 3 bar: `.tc-bf[data-m=CPU|MEM|LAT]` + `.tc-mv`
- 5 thread FIX: `T1 Memory Indexer`, `T2 Task Planner`, `T3 Tool Engine`, `T4 Swarm Coord`, `T5 Output Synth`

### Center (canvas + humanoid)
- `#holo` canvas 2D holographic core
- `.view-switch` dengan `.vs[data-view=core|swarm|memory|logs]` (`.on` = aktif)
- `.cvs-lbl` label mode kiri-atas · `.cvs-cc.tl/.tr/.bl/.br` corner brackets
- Humanoid: `#hum` (clickable) · `#sp` speech bubble · `#humSt` status line (Listening.../Speaking...)
- Face overlay: `#holoFace` (opsional, overlay canvas untuk face phases) + `#hudStatus`, `#hudPhase`, `#hudVerts`, `#hudEdges`, `#hudFps`, `#hudCycle`, `#phaseLabel`, `#scanBeam`

### Swarm Network (kanan)
- `#agCount` badge n/N · `#agentList` container agent cards: `.ac-nm` nama, `.ac-tp` tipe, `.pill` status, `.ac-st` token+tasks
- 5 agent FIX (dari ORCHESTRATOR.md): `chief` Hermes Chief, `research` Agent 01, `programmer` Agent 02, `qa` Agent 03, `creator` Agent 04

### Dock (bawah)
- `#logs` live log stream + `#logMeta` counter · `#activity` activity feed
- Voice: `#voiceBtn` toggle LISTENING/STOPPED · `#wave` waveform (40 bar `.wb`) · `#vInput` input + `#sndBtn` send

---

## 4. Tema (WAJIB dari v3.1 Final — orange/amber, BUKAN cyan)

```css
:root{
  --bg0:#040404;--bg1:#0a0a0a;--bg2:#111111;--bg3:#181818;--bg4:#222;
  --or300:#fdba74;--or400:#fb923c;--or500:#f97316;--or600:#ea580c;--or700:#c2410c;
  --am300:#fcd34d;--am400:#fbbf24;--am500:#f59e0b;
  --green:#22c55e;--blue:#3b82f6;--red:#ef4444;--violet:#8b5cf6;
  --t1:#fafafa;--t2:#a1a1aa;--t3:#52525b;--t4:#3f3f46;
  --glass:rgba(14,14,14,.78);--glass-b:rgba(249,115,22,.12);
  --r:12px;--rs:8px;
  --font-body:'Inter',system-ui,sans-serif;
  --font-head:'Space Grotesk',sans-serif;
  --font-mono:'JetBrains Mono',monospace;
  --ease:cubic-bezier(.4,0,.2,1);
}
```

Font: Google Fonts `Space Grotesk` + `JetBrains Mono` + `Inter`; icons Font Awesome 6.5.1 CDN.

**Wajib diadopsi dari v3.1:** custom cursor (ring+dot lerp+particle trail), bg-fx (grid 52px + 2 glow blur), glass `.gl` (backdrop blur 20px), pill status (active/idle/throttled/error), toggle switch uiverse-style, gradient button `.btn-g`, tooltip `[data-tip]`, responsive breakpoints 1100px/860px.

---

## 5. Kontrak API (data live — dari server.py port 5200)

Base: `http://localhost:5200`. **Semua fetch harus try/catch dengan fallback demo data** (server bisa mati — jangan crash).

| Endpoint | Response shape | Dipakai untuk |
|----------|----------------|---------------|
| `GET /api/mc/system` | `{cpu_percent, memory_percent, disk_percent, uptime, ...}` | `#svS`, `#hdrLat`(simulasi), health |
| `GET /api/mc/agents` | array `{agent_id, name, status, ...}` | `#agentList`, `#agCount` |
| `GET /api/mc/logs` | array `{timestamp, thread, message, level}` | `#logs`, `#logMeta`, activity |
| `GET /api/mc/tasks` | array tasks | active task count |
| `GET /api/mc/directive` | per-thread direktif | thread card sub-info |
| WS `/ws/swarm` | JSON messages | real-time feed (optional, fallback polling 3s) |

Status agent → pill: `active`=green, `idle`=gray, `error`=red, lainnya=throttled.
Level log → class: `ok`=green, `info`=blue, `warn`=amber, `err`=red.

---

## 6. Pembagian Kerja Agent

### Agent 1 → `aios/index.html`
- DOCTYPE + head (fonts, FA CDN, link 3 JS dengan `defer`)
- SEMUA CSS inline `<style>` (theme §4 + komponen dari v3.1 final)
- Body: cursor divs, bg-fx, header, main 3-col (pLeft/ctr/pRight), dock, humanoid — semua ID sesuai §3
- View-switch 4 mode + placeholder label di center (isi canvas oleh core.js)
- **Verifikasi:** buka file → tidak ada error CSS, semua ID ada, layout 3 kolom benar

### Agent 2 → `aios/core.js`
- `resizeCanvas` DPR-aware (max 2), pre-generated particles Float32Array (220), orbital rings 3, core glow radial, data rays 4, mouse parallax, batched draw — **SALIN pola dari v3.1 final §holo**
- Digital human: klik `#hum` → speech bubble `#sp` + status Speaking/Listening (pola v3.1) + auto-speech 18s
- Face hologram overlay (dari face-hologram-final): 7 fase cycle — PARTICLE CONVERGENCE → FACIAL RECONSTRUCTION → NEURAL MAPPING → BIOMETRIC ANALYSIS → DIGITAL FRAGMENTATION → SYSTEM RECOVERY → HOLOGRAM ONLINE; scan beam di fase BIOMETRIC; update `#hudVerts/#hudEdges/#hudFps/#hudPhase/#hudStatus/#hudCycle`; vertex/edge data wajah minimal 60 vertices (copy pola face-hologram, boleh disederhanakan tapi harus terlihat wajah)
- Aktifkan face mode saat `.vs[data-view=core]`, tampilkan label sesuai view lain (swarm/memory/logs → teks + mini visual sederhana)
- `prefers-reduced-motion` → phase cycle jalan lambat/tanpa partikel berlebih

### Agent 3 → `aios/orchestrator.js` + `aios/multimodal.js`
- **orchestrator.js:** fetch semua endpoint §5 dengan fallback demo (demo data REALISTIS sesuai kontrak — thread 5, agents 5, log levels), render `#threadList` (bar CPU/MEM/LAT animasi width), `#agentList`, `#logs` (max 30 entry), `#activity` (max 20), stats `#svT/#svA/#svL/#svS`, clock, health; polling 3s; WS `/ws/swarm` bila tersedia
- **multimodal.js:** Web Audio API singleton `sfx(freq,dur)` — click card 660Hz, send 990Hz, humanoid 440Hz; toggle `#tglSfx`; voice: Web Speech API (webkitSpeechRecognition) tombol `#voiceBtn` toggle + Spacebar fokus `#vInput`; gesture: MediaPipe lazy-load (hanya saat `#tglGest` on) dengan fallback teks "gesture unavailable"; waveform `#wave` 40 bar animasi sin+random (pola v3.1)
- **Verifikasi:** `node --check` kedua file, cek semua ID yang di-refer ada di index.html

---

## 7. Aturan Kualitas (WAJIB)

1. **BACA referensi dulu** — salin pola, jangan mengarang bebas
2. Zero console errors, zero undefined IDs
3. Semua fetch try/catch + fallback demo
4. Tidak ada emoji sebagai icon UI (pakai Font Awesome)
5. `cursor:pointer` pada semua elemen clickable
6. Animasi pakai `transform`/`opacity` (bukan width/height) kecuali bar meter
7. `prefers-reduced-motion` dihormati
8. Responsive: `@media(max-width:1100px)` collapse ke 2 kolom, `860px` single kolom (pola v3.1)
9. Bahasa UI: Indonesia (label), Inggris untuk data/mono

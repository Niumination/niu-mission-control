# 🎯 Redesign Plan — Personal AI OS Dashboard (niu-mission-control)

**Tanggal:** 2026-08-14 · **Sumber spesifikasi:** gemini-code prompt + **MC-Reference.zip (5 prototype v3.x)**
**Status:** ✅ SELESAI v4.1 — AIOS live di `http://localhost:5200/aios` (Phase 4: view modes fungsional + WS real-time, 2026-08-14)

---

## 1. Ringkasan

Mengubah `niu-mission-control` dari dashboard monitoring → **Personal AI OS Dashboard** ala JARVIS:
- 5-Thread Orchestrator Panel (pipeline internal Hermes)
- Swarm Agent Visualizer (node graph interaktif)
- Multimodal layer (MediaPipe gesture, voice command, sound feedback)
- 3D Holographic Core (Canvas 2D — keputusan final setelah analisis referensi)

**Prinsip:** backend FastAPI (40+ endpoints) **TIDAK dibangun ulang** — menjadi API layer. Hanya frontend yang di-redesign.

---

## 2. Audit Kondisi Saat Ini (fakta dari repo)

| Aset | Status | Relevansi |
|------|--------|-----------|
| `server.py` — 40+ endpoints REST + WS | ✅ Solid | API source of truth |
| `dashboard/index.html` — 12 halaman (v2.6 + template Asad) | ✅ Berfungsi | Legacy UI |
| `dashboard/orb.html` + orb.js — 3D ULTRON + gesture webcam v3 | ✅ Sudah ada | Fondasi 3D & gesture |
| `/api/mc/system` — CPU/RAM/disk/uptime | ✅ | VPS health |
| `/api/mc/tasks` — pending/running/done | ✅ | Queue & throughput |
| `/api/mc/logs` — agent log stream | ✅ | Activity feed |
| `/api/mc/agents` — status 5 agent | ✅ | Swarm state |
| `/api/mc/directive` — direktif per thread | ✅ (dibuat kemarin) | Thread context |

**Gap terhadap spesifikasi:**
- ❌ 5-thread pipeline panel (Memory/Planner/Tool/Swarm/Synth) — belum ada visualisasi
- ❌ Swarm node-graph interaktif (particle lines antar agent)
- ❌ MediaPipe gesture (orb.html cuma webcam dasar, belum hand-landmark)
- ❌ Voice command + audio waveform reactive
- ❌ Sound feedback (Web Audio API)
- ❌ 3D core audio-reactive (orb ada tapi belum audio-reactive)

---

## 3. Pendekatan (3 opsi + rekomendasi)

### Opsi A — Full Rewrite Next.js (sesuai prompt gemini)
- Next.js App Router + R3F + Zustand + Tailwind + Framer Motion
- **Pro:** arsitektur modern, komponen reusable, 3D penuh, scaling
- **Kontra:** ⚠️ Buang semua kerja (12 halaman, orb, integrasi Asad) · setup besar · Node build pipeline baru · **butuh saldo/baru deploy** (user pref free-tier)
- **Estimasi:** 2-3 minggu

### Opsi B — Integrasi Bertahap ke Dashboard Static (rekomendasi ✅)
- Pertahankan server.py + index.html; tambah **halaman baru** (prototype → full) di `dashboard/`
- Serve prototype via FastAPI static mount; data tetap dari API yang sama
- **Pro:** ⚡ Cepat (prototype sudah jalan), zero backend change, risk rendah, semua fitur lama utuh
- **Kontra:** JS vanilla (bukan React), 3D via Three.js CDN (bukan R3F)
- **Estimasi:** 3-5 hari per fitur; bertahap

### Opsi C — Hybrid: React sub-app di dalam FastAPI
- Satu route `/aios` serve React app (Vite build), sisanya tetap static
- **Pro:** React untuk bagian baru, FastAPI tetap API
- **Kontra:** dua toolchain (build pipeline + static), kompleksitas deploy

**Rekomendasi: Opsi B** — sesuai pref user (free/open-source, tidak buang kerja, prototype sudah teruji). Bisa naik ke C nanti jika diperlukan.

---

## 4. Roadmap Bertahap (Opsi B)

### Fase 1 — Integrasi Prototype ke Dashboard (dalam progress)
- [x] Prototype A: `prototypes/01-holographic-core.html` — 3D core (globe wireframe + partikel + ring, audio-reactive stub)
- [x] Prototype B: `prototypes/02-thread-orchestrator.html` — 5-thread panel (meter, latency, status)
- [x] Prototype C: `prototypes/03-ai-os-shell.html` — shell layout 5 zona (header/left/center/right/dock)
- [ ] Route `/aios` di server.py → serve shell + iframe core
- [ ] Wire data live (thread state dari tasks/logs, system, directive)

### Fase 2 — 5-Thread Pipeline Real
- [ ] Map 5 thread (Memory/Planner/Tool/Swarm/Synth) ke data Hermes nyata
- [ ] State: IDLE/PROCESSING/THROTTLED/ERROR dari log parsing
- [ ] Latency graph (history dari usageHistory / cost)

### Fase 3 — Swarm Node-Graph
- [ ] Canvas 2D node graph (chief → 4 worker), particle lines
- [ ] Click node → console log + token usage (dari /api/mc/logs + cost)

### Fase 4 — Multimodal
- [ ] MediaPipe Hand Landmarker (gesture: palm=freeze, pinch=zoom, swipe=view)
- [ ] Voice: Web Speech API (Spacebar hotkey) — sudah placeholder di shell
- [ ] Sound: Web Audio API synth (click, thread activation, hum) + mute toggle
- [ ] Audio-reactive core (analyser → scale/color)

### Fase 5 — Polish
- [ ] Reduce Motion support (user Mac REDUCE-MOTION ON — animasi dekoratif mati, running indicator jalan)
- [ ] Responsive (collapse sidebar <1100px)
- [ ] Mobile

---

## 5. Struktur File Target

```
services/niu-mission-control/
├── server.py                  # FastAPI (API layer — TIDAK diubah besar)
├── dashboard/                 # Legacy (12 halaman) — tetap
│   ├── index.html
│   ├── orb.html / orb.js
│   └── styles.css
├── prototypes/                # ✅ Prototype (baru)
│   ├── 01-holographic-core.html     # 3D core
│   ├── 02-thread-orchestrator.html  # 5-thread panel
│   └── 03-ai-os-shell.html          # shell layout
└── aios/                      # (Fase 1+) target final AI OS frontend
    ├── index.html             # shell final (dari prototype C)
    ├── core.js                # 3D + audio-reactive
    ├── orchestrator.js        # thread panel
    └── multimodal.js          # gesture + voice + sound
```

---

## 6. Tech Decisions

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| 3D | Three.js CDN (importmap) | Tanpa build, langsung jalan; R3F butuh Next |
| Gesture | MediaPipe tasks-vision CDN | Sesuai spesifikasi, free |
| Voice | Web Speech API | Free, native, Spacebar hotkey |
| Sound | Web Audio API synth | Free, tanpa asset file |
| State | Vanilla JS + API polling (30s) | Sederhana; Zustand hanya jika naik React |
| Stack | FastAPI + static | Zero backend change, free-tier |

---

## 7. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Browserbase/headless tak support WebGL penuh | Verifikasi via pixel analysis + local browser |
| MediaPipe berat (10MB) | Load lazy, hanya saat gesture diaktifkan |
| Voice API tak jalan di semua browser | Fallback input teks (sudah ada) |
| 3D berat di Mac | Particle count dibatasi, throttle FPS saat idle |
| REDUCE-MOTION | Semua animasi dekoratif conditional, indicator tetap jalan |

---

## 8. Deliverable Saat Ini

Prototype siap direview (buka di browser):
- `http://localhost:8899/prototypes/01-holographic-core.html` — 3D core
- `http://localhost:8899/prototypes/02-thread-orchestrator.html` — 5-thread
- `http://localhost:8899/prototypes/03-ai-os-shell.html` — shell penuh

**Next step (tunggu approval):**
1. Approve pendekatan (rekomendasi: Opsi B)
2. Fase 1: route `/aios` + wire data live
3. Lanjut Fase 2-5 sesuai prioritas

---

## 9. 🔍 Analisis Referensi MC-Reference.zip (2026-08-14)

5 prototype v3.x diekstrak ke `references/` — dievaluasi sebagai bahan integrasi:

| File | Versi | Baris | Kontribusi |
|------|-------|-------|------------|
| `hermes-dashboard-v3-final.html` | v3.1 Final | 818 | **Design system utama** — orange/amber theme, custom cursor, glass, thread/agent cards, dock, waveform, tooltips |
| `hermes-face-hologram-final.html` | v3.2 | 1006 | **Face hologram 7-fase** — wireframe wajah anatomis, biometric scan beam, HUD corners |
| `hermes-dashboard-orange/index.html` | v3.2 | 566 | HUD overlay + digital human |
| `hermes-v3.2-definitive.html` | v3.2 | 566 | Sama dengan orange |
| `hermes-dashboard-v3-orange.html` | v3.0 | 849 | Struktur dasar |

### Keputusan teknis dari analisis
1. **Canvas 2D murni, BUKAN Three.js/R3F** — semua 5 referensi pakai Canvas 2D (220 particles Float32Array, zero GC, 60 FPS). Lebih ringan, tanpa build, kompatibel browser. Revisi keputusan awal (Three.js).
2. **Theme orange/amber (#f97316/#fbbf24)** — konsisten di semua v3.x. Prototype kita cyan/violet → **diadopsi orange**.
3. **Digital human + face hologram** — fitur v3.2 yang belum ada di prototype → diadopsi sebagai overlay center.

### Gap prototype vs referensi (ditutup oleh build aios/)

| Fitur | Prototype A/B/C | Referensi v3.x | Aksi |
|-------|:---:|:---:|------|
| Custom cursor (ring+dot+trail) | ❌ | ✅ | Adopsi |
| Glass panels blur 20px | ✅ | ✅ | Pertahankan |
| Thread cards CPU/MEM/LAT | ⚠️ bar saja | ✅ + pill status | Adopsi lengkap |
| Digital human + speech | ❌ | ✅ | Adopsi |
| Face hologram 7-fase | ❌ | ✅ | Adopsi |
| Sound feedback (Web Audio) | placeholder | ✅ singleton | Adopsi |
| Waveform 40 bar | 16 bar | 40 bar | Adopsi |
| Toggle SFX/GEST | ❌ | ✅ | Adopsi |
| Tooltip data-tip | ❌ | ✅ | Adopsi |
| Stats 4 kartu live | ✅ | ✅ | Pertahankan + wire data |
| Data live API | ⚠️ polling 3s | simulasi | **Wire nyata + fallback** |

---

## 10. 🚀 Build aios/ (v4.0 — status)

Spesifikasi integrasi lengkap: `aios/SPEC.md` (kontrak DOM, tema, API, pembagian kerja).

| File | Isi | Agent | Status |
|------|-----|-------|--------|
| `aios/index.html` | Shell + semua CSS (orange theme, layout 3-kolom + dock, semua komponen) | Agent 1 | 🔨 |
| `aios/core.js` | Holo canvas 2D + digital human + face hologram 7-fase | Agent 2 | 🔨 |
| `aios/orchestrator.js` | Data live (API + WS, fallback demo) + render threads/agents/logs/stats | Agent 3 | 🔨 |
| `aios/multimodal.js` | Sound (Web Audio) + voice (Web Speech) + gesture (MediaPipe lazy) + waveform | Agent 3 | 🔨 |

**Route:** `/aios` di server.py ✅ (sudah ditambahkan) → `http://localhost:5200/aios`

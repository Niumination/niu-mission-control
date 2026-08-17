# 🏗️ BREAKDOWN REDESIGN TOTAL — niu-mission-control

**Tanggal:** 2026-08-17 · **Versi target:** v3.0.0 (reset penomoran — satu sumber kebenaran versi)
**Estimasi total:** 3–4 minggu (solo, part-time) atau 10–14 hari (fokus penuh)

> Catatan: `docs/REDESIGN_PLAN.md` lama hanya redesign frontend. Dokumen ini menggantikan itu
> dengan redesign penuh: keamanan → backend → orkestrasi → realtime → frontend → ops.

---

## PRINSIP REDESIGN

1. **Security first** — tidak ada "dev mode tanpa auth", tidak ada shell bebas.
2. **Satu UI, satu design system** — dashboard/, aios/, fusion/ dikonsolidasi jadi satu app.
3. **OpenAPI-first** — kontrak API ditulis dulu; frontend generate client dari situ.
4. **Event-driven** — semua perubahan state jadi event; UI = render dari stream.
5. **Portabel** — jalan di mesin mana pun via Docker; tanpa path hardcoded.
6. **Telegram = notifikasi**, bukan medium IPC orkestrasi.

---

## PHASE 0 — PERBAIKAN DARURAT 🔴 (0.5–1 hari, SEBELUM apa pun)

Jangan redesign apa pun sebelum ini selesai. Repo saat ini tidak aman untuk terekspos.

| # | Item | Detail | Acceptance |
|---|------|--------|-----------|
| 0.1 | Fix auth bypass | `public_paths` di `server.py`: ganti `path.startswith(p)` → cek eksplisit; `"/"` hanya match root persis | `curl /api/mc/system` tanpa key → 401 |
| 0.2 | Hardening terminal | Hapus `"python"` dari allowlist; parse dgn `shlex.split`; eksekusi tanpa `shell=True`; cwd terkunci ke folder project | `ls && rm x` diblok; `python -c ...` diblok |
| 0.3 | Purge data sensitif | `git filter-repo` hapus `data/dispatches.json`, chat ID, session ID dari history; rotate chat ID & session | History bersih; `git log -S "REDACTED_CHAT_ID"` kosong |
| 0.4 | .gitignore + .env | `data/*.json` runtime jangan ter-commit; `.env.example` tanpa nilai nyata | Commit baru tanpa data runtime |
| 0.5 | README minimal | Apa ini, screenshot, quickstart, link ORCHESTRATOR.md | Halaman repo bisa dipahami 30 detik |
| 0.6 | Hapus `.bak` | `dashboard/index.html.bak`, `.bak.2` | Repo tanpa file sampah |

**Gate:** semua ✅ baru lanjut Phase 1.

---

## PHASE 1 — KEPUTUSAN ARSITEKTUR + FONDASI (1 hari)

Tulis keputusan sebagai ADR (Architecture Decision Records) di `docs/adr/` supaya alasan tercatat.

### 1.1 Keputusan yang harus diambil

| Keputusan | Opsi | Rekomendasi |
|-----------|------|-------------|
| Frontend framework | React / Svelte / Vue | **Svelte 5 + Vite** (bundle kecil, cepat ditulis solo dev) — React jika ingin ekosistem terbesar |
| State + realtime | TanStack Query + WS store / Zustand + WS | Query untuk REST, satu WS store untuk stream |
| Message queue | Redis Streams / SQLite queue / NATS | **SQLite queue** (single-node, zero-dep, konsisten dgn WAL strategy) — Redis jika nanti multi-node |
| Database | SQLite (tetap) / Postgres | **SQLite + WAL** (USB-safe sudah terbukti) — migrasi ke Postgres dibuat opsional via adapter |
| Layout repo | Monorepo `backend/` + `frontend/` | **Ya** — pisahkan eksplisit |
| Versioning | Satu `__version__` + git tag | v3.0.0 untuk redesign ini |

### 1.2 Target struktur repo

```
niu-mission-control/
├── backend/
│   ├── app/
│   │   ├── main.py               # app factory
│   │   ├── core/                 # auth, ratelimit, config (pydantic-settings), logging
│   │   ├── routers/              # system, tasks, agents, telegram, artifacts, cost, skills, deploy
│   │   ├── services/             # logika bisnis per domain
│   │   ├── orchestration/        # state machine, dispatcher, agent adapters
│   │   ├── events/               # event store, WS hub, replay
│   │   ├── db/                   # schema, migrations (alembic-lite), repository
│   │   └── models/               # pydantic domain models
│   ├── tests/
│   └── pyproject.toml            # ganti requirements.txt; deps pinned + dev extras
├── frontend/
│   ├── src/
│   │   ├── components/           # design system (Button, Card, StatusPill, ...)
│   │   ├── views/                # L0-fleet, L1-kanban, L2-ops, L3-inspector
│   │   ├── stores/               # ws-store, query-store
│   │   ├── api/                  # generated dari OpenAPI
│   │   └── styles/               # design tokens (CSS variables)
│   └── e2e/                      # Playwright
├── deploy/
│   ├── Dockerfile, docker-compose.yml
├── docs/
│   ├── adr/, ARCHITECTURE.md, API.md
└── .github/workflows/ci.yml      # lint+typecheck+test+e2e+build
```

### 1.3 Kontrak API dulu
- Tulis OpenAPI spec (atau langsung dari router FastAPI + pydantic) untuk seluruh endpoint.
- Freeze kontrak → frontend & backend bisa dikembangkan paralel terhadap mock.

---

## PHASE 2 — BACKEND CORE (3–5 hari)

| # | Item | Detail |
|---|------|--------|
| 2.1 | App factory + config | `pydantic-settings`: semua env var tervalidasi; gagal start jika config wajib kosong (chat ID, home dir). Tidak ada path hardcoded — semua dari env/config. |
| 2.2 | Auth selalu-on | API key wajib (generate saat first-run simpan ke `.env`), perbandingan `hmac.compare_digest`. Opsional: RBAC role `viewer`/`operator`. |
| 2.3 | Rate limiting proper | Pakai `slowapi` atau token-bucket persisten; aman multi-worker. |
| 2.4 | Routers per domain | Pecah `server.py` 1.693 baris → 8 router; tiap router < 200 baris. |
| 2.5 | Services layer | Bisnis logic keluar dari router; router hanya validasi + panggil service. |
| 2.6 | DB layer | SQLite via `aiosqlite` + repository pattern; schema versioned; migrasi sederhana. Tabel: `tasks`, `agents`, `events`, `dispatches`, `artifacts`, `cost`, `audit`. |
| 2.7 | Event store | Setiap mutasi append event `(id, ts, type, payload)` — dasar untuk replay WS & audit. |
| 2.8 | Structured logging | JSON logs default (`python-json-logger` sudah ada), correlation id per request. |
| 2.9 | Tests | pytest per router + service; target: semua path kritis (auth, dispatch, task lifecycle) teruji. |

---

## PHASE 3 — ORCHESTRATION LAYER (3–4 hari)

Ini jantung mission control — ganti desain dispatch yang sekarang rapuh.

| # | Item | Detail |
|---|------|--------|
| 3.1 | Task state machine | `queued → delegated → running → review → done / failed / cancelled` — transisi divalidasi, persist di DB, setiap transisi emit event. |
| 3.2 | Dispatcher persisten | Queue di SQLite (bukan JSON file); worker loop dengan: claim → eksekusi → ack/nack; retry eksponensial max 3x; dead-letter untuk task gagal permanen. |
| 3.3 | Idempotency | Setiap dispatch punya `idempotency_key`; retry/ulang tidak bikin duplikat. |
| 3.4 | Agent adapter interface | `AgentAdapter` (protocol): `send(task)`, `poll_status()`, `collect_result()`. Implementasi: `HermesAdapter` (CLI bridge yang ada sekarang), `MockAdapter` (untuk test/dev). Session ID jadi **config + auto-detect**, bukan hardcode. |
| 3.5 | Approval gate | Aksi berbahaya (shell, deploy, kirim keluar) → status `awaiting_approval`; hanya lanjut setelah POST `/approve/{id}` dari UI. Semua tercatat di tabel `audit`. |
| 3.6 | Telegram = notif only | `TelegramNotifier` service: kirim update status/hasil ke topic. Arah masuk: webhook/polling → jadi task baru, bukan eksekusi langsung. |
| 3.7 | Cost tracker | Catat token/cost per task & agent (schema sudah ada konsepnya di endpoint `/cost`) — diisi adapter saat collect result. |

---

## PHASE 4 — REALTIME LAYER (1–2 hari)

| # | Item | Detail |
|---|------|--------|
| 4.1 | WS Hub | Satu endpoint `/ws` dengan rooms: `fleet`, `tasks`, `agents:{id}`, `logs`. Subscribe per room, bukan satu firehose. |
| 4.2 | Resume/replay | Client kirim `last_event_id` saat reconnect → server replay event dari store sejak titik itu. Tidak ada state hilang saat koneksi putus. |
| 4.3 | Heartbeat + backpressure | Ping/pong 30s; drop client lambat dengan log; broadcast via asyncio queue ter-batch. |
| 4.4 | Fallback SSE/polling | Untuk lingkungan yang memblokir WS (opsional). |

---

## PHASE 5 — FRONTEND TUNGGAL (5–8 hari)

Konsolidasi dashboard/ + aios/ + fusion/ → satu app di `frontend/`.

| # | Item | Detail |
|---|------|--------|
| 5.1 | Scaffold + design system | Vite + Svelte/React + TS; design tokens (warna, spacing, tipografi) sebagai CSS variables; komponen dasar (Button, Card, StatusPill, Modal, Toast). Pertahankan estetika glassmorphism yang sudah jadi identitas. |
| 5.2 | API client generated | Generate TypeScript client dari OpenAPI backend — tidak ada fetch manual. |
| 5.3 | **L0 — Fleet Overview** | Grid status 5 agent, task aktif vs selesai, cost hari ini, alert, health gateway/WS. Satu layar = paham situasi. |
| 5.4 | **L1 — Mission Kanban** | Kolom status state machine; kartu task (agent, model, progress, ETA, tombol intervensi); drag antar kolom manual + auto-update dari WS. |
| 5.5 | **L2 — Live Ops** | Streaming log per-agent (virtualized list, filter, search); dispatch composer (form terstruktur + command bar natural language); **approval gate UI** untuk aksi berbahaya; terminal read-only. |
| 5.6 | **L3 — Inspector** | Trace timeline per task; artifact explorer + diff; cost breakdown per agent/model/task; audit log keamanan. |
| 5.7 | ⌘K Command Palette | Navigasi cepat + eksekusi command (delegate, dispatch, buka task). Keyboard-first. |
| 5.8 | A11y & responsif | Pertahankan standar WCAG 2.1 AA yang sudah dicapai (focus ring, kontras, reduced-motion, keyboard nav). |
| 5.9 | E2E tests | Playwright: load dashboard → dispatch task mock → lihat status berubah via WS. |

**Nasib UI lama:** setelah cutover, `dashboard/`, `aios/`, `fusion/` dipindah ke branch `legacy-ui` (bukan dihapus) untuk referensi.

---

## PHASE 6 — OBSERVABILITY & ALERTING (1–2 hari)

| # | Item | Detail |
|---|------|--------|
| 6.1 | Metrics endpoint | `/metrics` sederhana (task throughput, error rate, latency dispatch) — siap diprometheus-kan nanti. |
| 6.2 | Alert rules | Agent error 3x beruntun, gateway down, budget harian terlampaui, queue menumpuk → notif Telegram + banner L0. |
| 6.3 | Audit UI | Halaman L3 menampilkan tabel `audit`: siapa, apa, kapan, hasil — termasuk approval decisions. |

---

## PHASE 7 — OPS & DEPLOY (1–2 hari)

| # | Item | Detail |
|---|------|--------|
| 7.1 | Dockerfile + compose | Backend + frontend (nginx serve static + proxy `/api` & `/ws` ke backend). Satu `docker compose up` jalan di mesin mana pun. |
| 7.2 | CI lengkap | ruff + mypy + pytest + Playwright e2e + frontend build; matrix Python 3.11–3.13 (sudah ada fondasinya). |
| 7.3 | Release process | Tag semver → auto version; CHANGELOG.md dijaga. |
| 7.4 | Backup | Cron: dump SQLite + `data/` ke archive ber-tanggal; retention 7 hari. |
| 7.5 | Dokumentasi | README lengkap, ARCHITECTURE.md (ganti ORCHESTRATOR.md usang), docs/adr/, komentar "kenapa" bukan "apa". |

---

## PHASE 8 — MIGRASI & CUTOVER (1 hari)

| # | Item | Detail |
|---|------|--------|
| 8.1 | Script migrasi data | `data/dispatches.json` + `swarm_config.json` → tabel SQLite baru (one-shot, idempotent). |
| 8.2 | Parallel run | Jalankan v2 (lama) dan v3 berdampingan di port berbeda 1–2 hari; bandingkan hasil dispatch nyata. |
| 8.3 | Checklist cutover | Semua fitur esensial lama ada padanan di v3 (delegate, dispatch, telegram send, artifacts, WAL checkpoint). |
| 8.4 | Cutover + rollback plan | v2 dipindah ke branch `legacy-v2`; rollback = checkout branch lama. |

---

## RINGKASAN TIMELINE

```
Phase 0  Darurat keamanan      ████ 0.5–1 hari   ← MULAI HARI INI
Phase 1  Keputusan + fondasi   ██ 1 hari
Phase 2  Backend core          ██████████ 3–5 hari
Phase 3  Orchestration         ████████ 3–4 hari
Phase 4  Realtime              ████ 1–2 hari
Phase 5  Frontend tunggal      ████████████████ 5–8 hari
Phase 6  Observability         ████ 1–2 hari
Phase 7  Ops & deploy          ████ 1–2 hari
Phase 8  Migrasi & cutover     ██ 1 hari
─────────────────────────────────────────────
TOTAL                          ~17–26 hari kerja
```

## RISIKO UTAMA & MITIGASI

| Risiko | Mitigasi |
|--------|----------|
| Scope creep (3 UI lama sama-sama disayang) | Keputusan eksplisit di Phase 1: satu UI canonical; sisanya legacy branch |
| Hermes CLI bridge berubah/rusak | Adapter interface isolasi perubahan; MockAdapter bikin dev tetap jalan |
| Kehilangan fitur saat rewrite | Parallel run (8.2) + checklist (8.3) sebelum hapus apa pun |
| solo-dev burnout | Fase bisa dipotong: Phase 0–3 = MVP backend aman; Phase 5 bisa dicicil per-view |
| SQLite bottleneck | Repository pattern memungkinkan ganti ke Postgres tanpa sentuh service |

## URUTAN MINIMUM VIABLE (jika waktu terbatas)
Kalau tidak bisa full 3–4 minggu, urutan paling berharga:
**Phase 0 → 2.1–2.4 → 3.1–3.5 → 5.3–5.5** = dashboard aman, orkestrasi tahan banting, UI tunggal dengan 3 view inti. Sisanya (cost, alert, docker) bisa nyusul.

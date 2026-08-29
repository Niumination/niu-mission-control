# Refactor Apex-Monorepo — Completion & Cutover Plan

> **⚠️ SUPERSEDED — TASK SELESAI** (2026-08-29)
>
> Refactor apex-monorepo **sudah tuntas** dan di-merge ke `main` (commit `10e1fbd`).
>
> **Lihat**: `README.md` (status terkini), `docs/CUTOVER_CHECKLIST.md` (cutover log), `legacy-ui` branch (snapshot v2.x).

**Goal:** Selesaikan refactor apex-monorepo Niu-MissionControl di branch `refactor/apex-monorepo`, buat CI hijau, lalu cutover (merge) ke `main` d...[truncated]
**Author:** Hermes Agent (Niumination)
**Date:** 2026-08-29
**Status:** ✅ SELESAI (2026-08-29) — merged ke main @ `10e1fbd`, tag `v3.0.0`

---

## Konteks (fakta terverifikasi, bukan asumsi)

Kondisi terkini repo (probe 2026-08-29 01:xx WIB):

| Fakta | Nilai |
|---|---|
| Branch aktif | `refactor/apex-monorepo` @ `1962edf` = `origin/main` (merge-base sama) |
| `origin/main` (via `ls-tree`) | MASIH struktur lama (backend/, dashboard/, aios/, fusion/, modules/, AGENTS.md) |
| Working tree branch refactor | Semua file lama sudah `D`; file baru `apex-ui/`, `frontend/static/`, `docs/adr/004` staged `A` |
| `server.py` | 65KB, syntactically OK, MASIH refer `dashboard/`, `aios/`, `/orb`, `DASHBOARD_DIR` |
| `frontend/static/` | HANYA berisi 2 `.DS_Store` — **KOSONG** (belum diisi asset frontend baru) |
| `apex-ui` | Git submodule → `RubenM1990/APEX-UI` (Next.js) |
| `ci.yml` | MASIH refer `backend/requirements.txt`, `backend/app/`, `backend/tests/`, `dashboard/index.html` — **CI pasti merah** |
| MC status | Mati total (LaunchAgent hilang, venv hilang, port 5200 kosong) |
| ADR-001/004 | Memutuskan vanilla-no-build; submodule Next.js = penyimpangan yang DIKONFIRMASI user untuk dipertahankan |

## Keputusan yang sudah dikonfirmasi user

1. **Selesaikan refactor di branch → merge ke main (cutover)**.
2. **Pertahankan submodule `apex-ui` (Next.js)** sebagai visual layer terpisah — JANGAN batalkan.
3. **Setelah refactor tuntas: deploy ulang LaunchAgent + venv fresh**.

---

## Invariant (harus selalu benar)

- **I1:** Tidak ada penghapusan history — file lama dipindah ke branch `legacy-ui`, bukan `git rm` permanen tanpa referensi.
- **I2:** `server.py` harus tetap jalan (syntax + import + health endpoint) setiap saat selama refactor — tidak boleh ada titik di mana backend broken.
- **I3:** CI harus hijau sebelum push ke `main`. Tidak pernah push merah ke main.
- **I4:** submodule `apex-ui` tetap terinisialisasi (`.gitmodules` utuh), tidak pernah dihapus.
- **I5:** `frontend/static/` harus berisi asset frontend yang benar-benar di-serve, bukan kosong.

---

## Global Constraints

- Pindahkan (bukan hapus) file lama: `git mv` ke branch/tag `legacy-ui` atau archive, bukan `git rm` telanjang.
- Frontend baru vanilla (ikut ADR-001/004) hidup di `frontend/`; `apex-ui` (Next.js) tetap sebagai submodule visual layer terpisah yang di-serve via build/route terpisah.
- `server.py` tetap backend kanonikal (FastAPI, port 5200). Tidak ada pemecahan ke backend v3 di plan ini (itu scope redesign terpisah).
- Dependencies Python tetap minimal (FastAPI + uvicorn + yang sudah ada di `requirements.txt`).

---

## Struktur target (setelah refactor)

```
niu-mission-control/
├── server.py              # Backend kanonikal (tetap)
├── requirements.txt       # Deps root (baru, menggantikan backend/requirements.txt)
├── frontend/              # UI vanilla kanonikal (diisi dari dashboard/ lama)
│   └── static/            # index.html, orb.html, orb.css, orb.js, ...
├── apex-ui/               # submodule Next.js (visual layer terpisah, tetap)
├── docs/                  # ADR + plan ini + API.md
├── .github/workflows/ci.yml  # DIUPDATE untuk struktur baru
├── tests/                # test server.py (root)
└── legacy-ui/             # (branch/tag) — dashboard/, aios/, fusion/, modules/ lama
```

---

## Task 1: Amankan legacy UI ke branch terpisah (sebelum menyentuh apa pun)

**Files:**
- Buat branch `legacy-ui` yang memuat snapshot working tree lama (dashboard/, aios/, fusion/, modules/, prototypes/, references/, backend/)

- [ ] **Step 1:** Dari `main` (struktur lama), buat branch `legacy-ui` yang merekam snapshot state lama:
  `git checkout main && git checkout -b legacy-ui && git push origin legacy-ui`
- [ ] **Step 2:** Pastikan semua file lama (backend/, dashboard/, aios/, fusion/, modules/) ada di branch `legacy-ui` via `git ls-tree legacy-ui --name-only`
- [ ] **Step 3:** Kembali ke branch refactor: `git checkout refactor/apex-monorepo`
- [ ] **Step 4:** Verifikasi branch legacy-ui ada, refactor branch masih utuh (tidak ternodai)
- [ ] **Step 5:** Commit (jika ada perubahan branch terbooking)

---

## Task 2: Isi `frontend/static/` dari aset dashboard lama

**Files:**
- Sumber: `frontend/static/` (target), `dashboard/` (dari branch legacy-ui sebagai referensi)

- [ ] **Step 1:** List file dashboard lama yang masih relevan sebagai UI vanilla:
  `git ls-tree legacy-ui --name-only | grep '^dashboard/'`
- [ ] **Step 2:** Copy file UI inti (index.html, orb.html, orb.css, orb.js, styles.css, app.js) ke `frontend/static/` (bukan git mv dari branch — copy konten, jaga riwayat terpisah)
- [ ] **Step 3:** Verifikasi `frontend/static/index.html` ada dan valid (bukan kosong)
- [ ] **Step 4:** Commit `feat(frontend): populate frontend/static from legacy dashboard assets`

---

## Task 3: Update `server.py` static routing ke struktur baru

**Files:**
- Modify: `server.py` (DASHBOARD_DIR, AIOS_DIR, mount `/static`, route `/dashboard`, `/aios`, `/orb`)

- [ ] **Step 1:** Ganti `DASHBOARD_DIR = os.path.join(BASE_DIR, "dashboard")` → `FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "static")`
- [ ] **Step 2:** Update semua `app.mount("/static", ...)` → serve dari `FRONTEND_DIR`
- [ ] **Step 3:** Update route `/dashboard`, `/`, `/orb` → serve dari `frontend/static/` (file `index.html`, `orb.html`)
- [ ] **Step 4:** Jaga route `/aios` tetap (jika aios dipertahankan) ATAU redirect ke frontend baru (putuskan berdasarkan keberadaan aios assets — ikut invariant I2: jangan break)
- [ ] **Step 5:** `python3 -c "import ast; ast.parse(open('server.py').read())"` → OK
- [ ] **Step 6:** Uji smoke run server.py → `/health` 200, `/` serve HTML (via uvicorn lokal, matikan setelah test)
- [ ] **Step 7:** Commit `fix(server): serve static from frontend/static`

---

## Task 4: Update CI ke struktur baru

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1:** Ganti `pip install -r backend/requirements.txt` → `pip install -r requirements.txt` (root)
- [ ] **Step 2:** Ganti lint `ruff check backend/app/` → `ruff check server.py` (atau target yang relevan)
- [ ] **Step 3:** Ganti test path `cd backend && pytest tests/` → `pytest tests/` (root)
- [ ] **Step 4:** Ganti frontend asset check `dashboard/index.html` → `frontend/static/index.html`
- [ ] **Step 5:** Sync test matrix — pastikan pytest menemukan test yang valid (atau minimal `--collect-only` hijau)
- [ ] **Step 6:** Commit `ci: update workflow for apex-monorepo structure`

---

## Task 5: Rebuild venv + smoke test backend lokal

**Files:**
- `requirements.txt` (root, pin deps), `venv/` (baru, git-ignored)

- [ ] **Step 1:** Buat `requirements.txt` root berisi deps FastAPI + uvicorn + sqlalchemy/aiosqlite + json-logger (salin dari legacy `backend/requirements.txt`, pastikan bisa install)
- [ ] **Step 2:** `python3 -m venv venv && venv/bin/pip install -r requirements.txt`
- [ ] **Step 3:** `venv/bin/python -c "import server"` → import OK tanpa error missing module
- [ ] **Step 4:** Smoke test: `venv/bin/uvicorn server:app --port 5299` di background → curl `/health` 200 → matikan
- [ ] **Step 5:** Commit `chore: root requirements.txt + venv smoke tested`

---

## Task 6: Merge refactor → main (cutover)

**Files:** branch `main`

- [ ] **Step 1:** Pastikan CI hijau di branch refactor (lihat Task 4; push branch, pantau run)
- [ ] **Step 2:** `git checkout main && git merge --no-ff refactor/apex-monorepo -m "merge: apex-monorepo refactor (cutover)"`
- [ ] **Step 3:** Verifikasi `main` sekarang punya `frontend/`, `apex-ui` submodule, `server.py` baru
- [ ] **Step 4:** Push `git push origin main` → pantau CI main hijau
- [ ] **Step 5:** Tag `git tag v3.0.0` (atau bump semver sesuai policy) + push tag

---

## Task 7: Deploy ulang LaunchAgent + hidupkan MC

**Files:**
- `~/Library/LaunchAgents/niu.missioncontrol.plist` (recreate)
- venv path absolute

- [ ] **Step 1:** Buat plist LaunchAgent `niu.missioncontrol` dengan `ProgramArguments` = `venv/bin/python3 server.py` (path absolute, port 5200), `KeepAlive=true`, `RunAtLoad=true`, env `HERMES_HOME`, `HERMES_TELEGRAM_CHAT_ID`
- [ ] **Step 2:** Salin plist ke `/Users/zaryu/Library/LaunchAgents/` + `launchctl bootstrap gui/501 <plist>`
- [ ] **Step 3:** `curl http://localhost:5200/health` → 200; `/healthz` → 200
- [ ] **Step 4:** DoD control-loop: `kill -9` PID → tunggu ~6s → PID baru + health 200 (proves KeepAlive)
- [ ] **Step 5:** Re-run `up-eco.sh` → rekomendasi MC kosong
- [ ] **Step 6:** Commit perubahan deployment (jika ada file repo yang berubah)

---

## Task 8: Dokumentasi + changelog ekosistem

**Files:**
- `README.md` (recreate minimal, dari legacy), `docs/` update, `brain/docs/ecosystem-changelog.md`

- [ ] **Step 1:** Tulis README.md baru yang mencerminkan struktur apex-monorepo (quickstart, struktur, cara deploy)
- [ ] **Step 2:** Update `docs/API.md` jika ada route yang berubah (frontend path)
- [ ] **Step 3:** Append entry ke `brain/docs/ecosystem-changelog.md`
- [ ] **Step 4:** Commit + push

---

## Self-Review (sebelum eksekusi)

- **Spec coverage:** ✅ Semua keputusan user tercakup (refactor→merge, submodule tetap, deploy ulang)
- **Placeholder scan:** ✅ Tidak ada TBD; semua step punya aksi konkret
- **Type/state consistency:** ✅ Invariant I1-I5 dihormati di tiap task
- **Risiko terbesar:** Task 3 (routing server.py) — mitigasi: invariant I2 (health selalu 200 + smoke test sebelum commit)

## Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| server.py break saat update routing | Smoke test + ast.parse sebelum commit (Task 3 step 5-6) |
| CI refer path salah | Task 4 sync penuh + pantau run |
| venv deps beda | Copy dari legacy requirements.txt yang sudah terbukti |
| submodule tidak ter-clone di CI | `actions/checkout` + `submodules: recursive` di ci.yml (tambahan di Task 4) |
| apex-ui Next.js butuh build untuk serve | Jika tidak perlu di-serve di path utama, biarkan sebagai submodule rujukan; serve hanya vanilla frontend (ikut ADR-001/004) |
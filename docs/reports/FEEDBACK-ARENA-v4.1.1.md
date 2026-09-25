# Catatan untuk Arena — v4.1.1 Aether Sync

**Dari:** Afrizal Munthe (Niumination) · **Tanggal:** 26 September 2026
**Bundle:** `mc-aether#2.zip` (v4.1.1, 261 file)
**Tujuan:** empat masalah di bawah ditemukan saat adopsi lokal. Mohon **tidak
diulang** di rilis arena berikutnya. Semua sudah diperbaiki di repo
`Niumination/niu-mission-control` dan bisa dipakai sebagai acuan.

---

## 1. `migrations/000` gagal di DB kosong

**Gejala**

```
Error: Failed to collect configuration for /api/mc/approvals/[id]/reject
  [cause]: SqliteError: no such table: tasks
  code: 'SQLITE_ERROR'
```

**Penyebab**

`000_baseline_v3_to_v4.sql` berisi `ALTER TABLE tasks RENAME COLUMN …` dan
`UPDATE tasks …`. DB yang belum punya tabel (install baru) langsung gagal.
Karena Next.js membuka DB saat *collect page data*, seluruh build mati.

SQL tidak punya `ALTER TABLE IF EXISTS`, dan SQLite **tidak punya** trigger
`BEFORE ALTER` (dicek langsung — `CREATE TRIGGER … BEFORE ALTER ON t` →
`syntax error`). Jadi `ALTER` conditional tidak bisa ditulis di dalam `.sql`.

**Perbaikan (sudah di `niu-mission-control`)**

- `migrations/000_baseline_v3_to_v4.sql` sekarang **hanya berisi komentar** —
  nol statement
- Skema + data dipindah ke `lib/server/ensure-v3-columns.ts`, dipanggil runner
  **sebelum** loop migrasi
- Fungsi tersebut idempoten: aman di DB kosong maupun DB v3
- Bonus: file migrasi tidak perlu lagi dihapus manual di install baru

**Pelajaran:** migrasi baseline harus diuji di **dua** arah — DB kosong (fresh
install) dan DB versi lama (upgrade). Salah satu saja tidak cukup.

---

## 2. `npm run lint` pasti gagal di Next 16

**Gejala**

```
$ npm run lint
Invalid project directory provided, no such directory: /…/apex-ui/lint
```

**Penyebab**

`next lint` **dihapus** di Next 16, tapi `package.json` masih memakai
`"lint": "next lint"`. Repo juga masih punya `.eslintrc.json` (format lama),
sedangkan ESLint v9 hanya membaca `eslint.config.js`.

`.github/workflows/` menjalankan `npm run lint`, jadi **pipeline CI akan merah
pada langkah pertama** — belum pernah dieksekusi end-to-end.

**Perbaikan**

- `package.json` → `"lint": "eslint ."`
- Tambah `apex-ui/eslint.config.mjs` (flat config, `core-web-vitals` +
  `react-hooks`, parser `@typescript-eslint/parser`)
- Dev deps baru: `@typescript-eslint/parser`, `eslint-plugin-react-hooks`

Hasil setelah diperbaiki: **0 error, 6 warning** (`react-hooks/exhaustive-deps`).

---

## 3. Race condition di migration runner (Next 16)

**Gejala**

```
[cause]: SqliteError: UNIQUE constraint failed: schema_migrations.version
  code: 'SQLITE_CONSTRAINT_PRIMARYKEY'
```

**Penyebab**

Build Next 16 menjalankan route handler di banyak worker paralel
(`Collecting page data using 7 workers`). Semua worker membaca tabel
`schema_migrations` pada waktu hampir bersamaan, lalu semuanya menjalankan
`INSERT INTO schema_migrations` untuk versi yang sama. Yang kalah crash.

Runner sebelumnya sudah benar untuk single-process, tapi tidak untuk build
multi-worker.

**Perbaikan**

`INSERT OR IGNORE` + cek `res.changes === 0` di dalam transaksi, dengan flag
`claimed` supaya hanya worker yang benar-benar meng-install migrasi yang
menjalankan SQL-nya.

---

## 4. Duplikasi berkas (satu file, dua rumah)

**Gejala** — tiga duplikasi di dalam bundle:

| Duplikat | Status |
|---|---|
| `docs/adr/00{1..6}*.md` | **byte-identik** dengan `docs/dox/00{1..6}*.md` |
| `scripts/secret-scan-staged.py` | identik dengan `apex-ui/scripts/secret-scan-staged.py` (md5 sama) |
| `data/backups/backup-2026-09-25-170317.db` | artefak runtime, bukan kode |

**Ketidaksesuaian dengan DOX v4.0**

> *"One-home rule: satu file hanya punya satu repo-home."*

Selain itu `docs/dox/INDEX.md` sudah menulis sendiri bahwa `docs/adr/`
*pindah* ke `docs/dox/` — jadi `adr/` memang sisa yang belum dibersihkan.
`README.md` juga masih menunjuk ke `docs/adr/`.

**Perbaikan (sudah diterapkan)**

- `docs/adr/` dihapus (isi identik, `dox/` yang jadi rumah resmi)
- Pointer `README.md` diarahkan ke `docs/dox/`
- `apex-ui/scripts/secret-scan-staged.py` dihapus (salin ke `scripts/`)
- `data/backups/` dihapus dari bundle

---

## Permintaan tambahan

**1. Jalankan pipeline sungguhan.** Todas klaim di `FINAL_VERIFICATION_v4.1.md`
(build hijau, 11 halaman, vitest 12/12) berasal dari satu mesin dengan DB
kosong. Yang tidak tercover: DB versi lama, `npm run lint` (lihat #2), dan
build multi-worker (lihat #3). Satu `npm ci && npm run lint && npm test &&
npm run build` dari checkout bersih sudah cukup menemukan ketiganya.

**2. Sertakan DB uji.** Migrasi hanya bisa dibuktikan dengan data.现代农业astinya
sederhana: sertakan fixture `tests/fixtures/v3.db` (DB kosong + 5 tabel v3
dengan beberapa baris) supaya migrasi bisa diuji otomatis di kedua arah.

**3. Hapus `mc-aether-sync-v4.1.1.zip` (60 file).** Bundle itu partial —
hanya file yang berubah, dan **tidak** menyertakan `migrations/001_initial.sql`.
Kalau di-rsync dengan `--delete`, aplikasi kehilangan `middleware.ts`,
`state-machine.ts`, `auth.ts`, `AppShell.tsx`, `globals.css`, dan seluruh
halaman `app/(app)/`. Pakai worktree lengkap (`mc-aether#2.zip`) untuk adopsi.

**4. `.gitignore` jangan meng-ignore berkas yang sudah tracked.**
`docs/deploy-launchagent.sh` masuk `.gitignore` padahal sudah tracked sejak v3
dan berisi nol kredensial. Akibatnya `scripts/secret-scan-staged.py` menolak
commit — gate jadi menyesatkan, bukan melindungi.

---

## Ringkasan verifikasi di sisi Niumination

| Item | Hasil |
|---|---|
| Build Next 16.3.5 | exit **0**, `Proxy (Middleware)` terdeteksi, 11 route |
| `npx tsc --noEmit` | **0** error |
| `npm test` (vitest) | **12/12** |
| `npm run lint` | **0** error, 6 warning |
| `scripts/test-sse.mjs` | **10/10** (3× berturut pada repo dengan DB nyata) |
| Migrasi dua arah | **PASS** — DB kosong 13 tabel/22 index · DB v3 13 tabel/24 index, data 15/5/1 utuh |

`test-sse.mjs` pernah gagal 1× (`task.completed` tidak sampai). Penyebabnya
bukan bug: `MockAdapter` punya 15% failure rate by design, dan retry/backoff
berhasil. Log dispatcher membuktikan `claimed → failed (retry 1/3, backoff 2s)
→ claimed → completed`. Tiga run berikutnya 10/10.

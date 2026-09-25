# Hermes Apply — v4.1.1 Aether Sync Perfected

**Source:** Workspace arena.ai `/home/user/niu-mission-control/` (v4.1.1 Perfected)  
**Target:** Local repo `~/Desktop/Niumination/services/niu-mission-control/` (remote main v4.0.0 a051bd3 + a40dac8)  
**Tanggal:** 26 Sep 2026  
**Versi:** v4.0.0 (remote) → v4.1.1 Perfected (local) → tag v4.1.1

---

## 1. Prasyarat

```bash
cd ~/Desktop/Niumination/services/niu-mission-control/
git status # harus clean, main branch, remote origin
git pull origin main # pastikan sudah a051bd3 + a40dac8 (v4.0.0 + docs sync)
git config core.hooksPath .githooks # aktifkan DOX gate (jika belum)
```

## 2. Copy File dari Workspace (Zip)

Workspace sudah di-zip sebagai `mc-aether-sync-v4.1.1.zip` (atau folder). Copy selective (DOX rule: never `git add .`):

### F1 DOX Compliance (baru)

```bash
# Dari workspace zip, copy ke local:
cp -r AGENTS.md ./
cp -r .nvmrc ./
cp -r .githooks/ ./
cp -r scripts/secret-scan-staged.py ./scripts/
cp -r scripts/sync-env.sh ./scripts/
cp -r apex-ui/.nvmrc ./apex-ui/
cp -r docs/dox/ ./docs/
cp -r docs/registry/ ./docs/
cp -r docs/reports/ ./docs/
cp -r docs/references/ ./docs/
```

### F2 Stack Upgrade Next 16 (modified)

```bash
cp apex-ui/package.json ./apex-ui/
cp apex-ui/package-lock.json ./apex-ui/
cp apex-ui/next.config.ts ./apex-ui/
cp apex-ui/proxy.ts ./apex-ui/
rm -f ./apex-ui/middleware.ts # deprecated, now proxy.ts
cp apex-ui/tsconfig.json ./apex-ui/
cp apex-ui/lib/server/api-helpers.ts ./apex-ui/lib/server/
cp apex-ui/lib/server/db.ts ./apex-ui/lib/server/ # singleton globalThis fix
cp apex-ui/lib/server/dispatcher.ts ./apex-ui/lib/server/ # budget kill-switch
cp apex-ui/app/api/mc/agents/[id]/route.ts ./apex-ui/app/api/mc/agents/[id]/
cp apex-ui/app/api/mc/tasks/[id]/route.ts ./apex-ui/app/api/mc/tasks/[id]/
cp apex-ui/app/api/mc/backups/[name]/route.ts ./apex-ui/app/api/mc/backups/[name]/
```

### F3 Testing (baru)

```bash
cp apex-ui/vitest.config.ts ./apex-ui/
cp -r apex-ui/tests/ ./apex-ui/
cp apex-ui/lib/server/state-machine.test.ts ./apex-ui/lib/server/
cp apex-ui/lib/server/schema.test.ts ./apex-ui/lib/server/
cp apex-ui/lib/server/backup.test.ts ./apex-ui/lib/server/
```

### F4 Fitur Ekosistem (baru)

```bash
mkdir -p ./apex-ui/public
cp apex-ui/public/manifest.json ./apex-ui/public/
cp apex-ui/public/sw.js ./apex-ui/public/
mkdir -p ./apex-ui/lib/i18n
cp apex-ui/lib/i18n/dict.ts ./apex-ui/lib/i18n/
cp apex-ui/lib/i18n/useLocale.ts ./apex-ui/lib/i18n/
cp apex-ui/components/TitleSync.tsx ./apex-ui/components/
# next.config.ts sudah include rewrites API v1 alias
```

### F6 Deploy Fix (modified)

```bash
cp apex-ui/deploy/com.niumination.missioncontrol.plist ./apex-ui/deploy/
cp apex-ui/deploy/docker-compose.yml ./apex-ui/deploy/
cp apex-ui/deploy/niumination-missioncontrol.service ./apex-ui/deploy/
cp apex-ui/deploy/start.sh ./apex-ui/deploy/
cp .github/workflows/ci.yml ./.github/workflows/
cp README.md ./
cp apex-ui/README.md ./apex-ui/
cp docs/STATUS.md ./docs/
cp docs/CHANGELOG.md ./docs/
cp .env.example ./
cp apex-ui/.env.example ./apex-ui/
```

### Catatan: Migration 000

Remote sudah punya `apex-ui/migrations/000_baseline_v3_to_v4.sql` (a051bd3). Lokal workspace juga punya file sama (copied dari raw GitHub). Pastikan file ada dan identik:

```bash
ls -lh ./apex-ui/migrations/
# harus ada 000_baseline_v3_to_v4.sql + 001_initial.sql
```

Jika belum ada 000 di local (sebelum a051bd3), copy dari workspace:

```bash
cp apex-ui/migrations/000_baseline_v3_to_v4.sql ./apex-ui/migrations/
```

## 3. Verifikasi Lokal (Wajib)

```bash
cd ~/Desktop/Niumination/services/niu-mission-control/
git config core.hooksPath .githooks

cd apex-ui
npm ci
npm run lint
npx tsc --noEmit # harus 0 error
npm run test # 12/12
npm run build # Next 16.3.5 webpack 9.7s, 11 pages, proxy detected

# Start dev
npm run dev &
sleep 5
curl -s -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"password":"apex"}' > /dev/null
curl -s -b /tmp/c.txt http://localhost:3000/api/mc/health | jq
curl -s -b /tmp/c.txt http://localhost:3000/api/v1/mc/health | jq # v1 alias
MC_PASSWORD=apex node scripts/test-sse.mjs # 10/10 expected setelah DB singleton fix
node tests/e2e/a11y.mjs # 7 routes a11y

# Stop dev
pkill -f "next dev"
```

## 4. Commit Selective (DOX Rule)

```bash
cd ~/Desktop/Niumination/services/niu-mission-control/

# Never git add . — selective only
git add AGENTS.md .nvmrc .githooks/pre-commit
git add scripts/secret-scan-staged.py scripts/sync-env.sh
git add docs/dox/ docs/registry/ docs/reports/ docs/references/
git add apex-ui/.nvmrc apex-ui/next.config.ts apex-ui/proxy.ts
git add apex-ui/package.json apex-ui/package-lock.json apex-ui/tsconfig.json
git add apex-ui/lib/server/api-helpers.ts apex-ui/lib/server/db.ts apex-ui/lib/server/dispatcher.ts
git add apex-ui/app/api/mc/agents/[id]/route.ts apex-ui/app/api/mc/tasks/[id]/route.ts apex-ui/app/api/mc/backups/[name]/route.ts
git add apex-ui/vitest.config.ts apex-ui/tests/ apex-ui/lib/server/*.test.ts
git add apex-ui/public/manifest.json apex-ui/public/sw.js
git add apex-ui/lib/i18n/ apex-ui/components/TitleSync.tsx
git add apex-ui/deploy/ .github/workflows/ci.yml
git add README.md apex-ui/README.md docs/STATUS.md docs/CHANGELOG.md .env.example apex-ui/.env.example

git status # cek tidak ada .env.local, data/, node_modules/, .next/

git commit -m "feat(v4.1.1): Aether Sync Perfected — Remote v4.0 sync + Next 16.3.5 + DOX + PWA + i18n + vitest + budget + deploy fix

- Sync remote a051bd3: migrations/000_baseline_v3_to_v4.sql 101 baris (tasks agent_id→assigned_agent +14 cols, agents +9 cols active→idle chief hermes→mock, cost_tracking +6 cols, dispatches +3, system_logs +2) + backup vault/_arsip-sensitif
- Sync remote a40dac8: docs/STATUS.md rewrite M1-M11 + route group app/(app)/ + API 16 endpoint + migrasi table + verifikasi 26 Sep 2026
- Perfected v4.1.1:
  - DB singleton globalThis __mc_db__ survive HMR Next 16 webpack — fix slow tick 48s → <500ms, SSE 9/10→10/10
  - Plist fix duplicate KeepAlive → single dict SuccessfulExit false + Crashed true + NetworkState true (DOX) + plist valid
  - Compose 4.0→4.1 + BUDGET_ENFORCEMENT + logging json-file, systemd standalone + budgets, start.sh standalone
  - .env.example BUDGET_ENFORCEMENT soft/hard + HERMES_GATEWAY_URL + OLLAMA_HOST
  - STATUS.md merged remote v4.0 + v4.1 F1-F6 + known issues + next actions
  - Next 16.3.5 webpack 9.7s, TS 5.9.2 ES2022, proxy.ts, api-helpers any+ctx any, dbParams rename, build --webpack
  - PWA manifest+sw.js v2, i18n 100 keys ID/EN + TitleSync, API v1 alias rewrites + CORS, budget kill-switch soft/hard
  - Tests vitest 12/12 + a11y.mjs 7 routes + CI Node22 tsc0+vitest+build+SSE+a11y

Verifikasi: build 9.7s 11 pages, tsc 0, vitest 12/12, routes 7/7 200 OK, health ok + v1 alias, PWA, i18n, budget, DOX, deploy plist valid

Ready for v4.1.1 tag + push + PR cross-repo ecosystem-config, niu-dash, Niu-OSS-Dashboard"

git tag v4.1.1
git push origin main --tags
```

## 5. PR Cross-Repo (F5)

Setelah push main v4.1.1, buat PR ke:

- `ecosystem-config` — update README services + registry (lihat docs/registry/ecosystem-pr.md)
- `niu-dash` — 112→113 projects (lihat niu-dash-pr.md)
- `Niu-OSS-Dashboard` — 90→91 repos (lihat oss-dashboard-pr.md)

Gunakan selective git add + DOX pass + secret-scan gate.

## 6. Catatan Penting

- **DB v3 legacy:** Jika install baru tanpa DB v3, hapus `000_baseline_v3_to_v4.sql` (ALTER TABLE akan gagal di DB kosong). Atau biarkan, tapi runner migration akan coba dan gagal — perlu handle IF EXISTS. Untuk sekarang, file ada di repo karena remote a051bd3 include, tapi di install baru sebaiknya hapus atau buat conditional.
- **.env.local:** Jangan commit, sudah di .gitignore, tapi pernah ikut di zip `mc-aether.zip` — rotate secrets di production.
- **Turbopack:** Next 16 default Turbopack fail karena better-sqlite3 + lightningcss native — kita pakai webpack mode `--webpack` di package.json dev & build. Sudah di next.config.ts turbopack: {} empty.
- **SSE:** Setelah DB singleton fix, expected 10/10 di Next 16 dev (sebelumnya 9/10 slow tick 48s).

---

*Generated: 26 Sep 2026 18:45 WIB — Afrizal Munthe + Hermes Chief — v4.1.1 Perfected*

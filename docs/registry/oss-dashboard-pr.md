# PR — Niu-OSS-Dashboard aggregator v4.1

**Target Repo:** `github.com/Niumination/Niu-OSS-Dashboard`  
**Current:** 90 repos aggregator, API v1 107 endpoints, live niumination.web.id  
**Target:** 91 repos (add niu-mission-control)

## How aggregator works

OSS Dashboard agregator via GitHub REST API:

- `scripts/fetch-repos.mjs` atau similar — fetch `github.com/niumination` org repos (90 public)
- Categorize otomatis via topics, README, package.json
- `data/repos.json` + `data/featured.json` + `data/stats.json`
- API publik v1: `/api/v1/repos`, `/api/v1/stats`, etc (107 endpoints)
- Build 214 pages, ISR force-cache

## Mission-control should be auto-detected if public

Check:

- Repo `Niumination/niu-mission-control` is public ✅
- Has `package.json` with `next` dependency ✅
- Has topics? Add topics: `nextjs`, `ai-agent`, `mission-control`, `sqlite`, `sse`, `zustand`, `tailwind`, `pwa`, `i18n`

If not auto-detected, add manual entry in `data/featured.json` or `data/repos.json`:

```json
{
  "name": "niu-mission-control",
  "full_name": "Niumination/niu-mission-control",
  "description": "Self-hosted AI Agent Control Plane v4.1 Aether Sync — Next.js 16.3.5 + SQLite WAL + SSE + PWA + i18n",
  "language": "TypeScript",
  "topics": ["nextjs", "ai-agent", "mission-control", "sqlite", "sse", "zustand", "tailwind", "pwa", "i18n", "dox"],
  "category": "services",
  "stack": ["Next.js 16", "SQLite WAL", "SSE"],
  "status": "active",
  "version": "v4.1.0",
  "deploy": "self-hosted",
  "dox": true
}
```

## PR Message

```
feat(data): add niu-mission-control v4.1 — 91 repos aggregator

- Next.js 16.3.5 / SQLite WAL / SSE / Zustand / Tailwind 4 / R3F
- PWA offline (manifest + sw.js v2) + i18n 100 keys ID/EN + TitleSync
- API v1 alias /api/v1/mc/* → /api/mc/* + CORS
- DOX v4.0: AGENTS.md + .githooks secret-scan + docs reorg + .nvmrc 22
- Tests: tsc 0 + vitest 12/12 + build 11 pages + a11y 7/7

Aggregator: 90 → 91 repos
API v1: 107 endpoints (existing) + alias for mission-control health
```

## Verification

- [ ] `npm run data:fetch` or `scripts/fetch-repos.mjs`
- [ ] `tsc 0`, `vitest 62/62`, `build 214/214` still green (now 215/215 with new repo)
- [ ] E2E hidrasi 12/12 + a11y 13/13 still pass
- [ ] Vercel deploy success + niumination.web.id shows 91 repos

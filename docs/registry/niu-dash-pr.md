# PR — niu-dash inventory v4.1

**Target Repo:** `github.com/Niumination/niu-dash`  
**Current:** 112 projects tracked (v2.17.0)  
**Target:** 113 projects tracked

## Files to update

### data/projects.json atau public/data/projects.json

Tambah entry:

```json
{
  "id": "niu-mission-control",
  "name": "Niu Mission Control",
  "repo": "Niumination/niu-mission-control",
  "description": "Self-hosted AI Agent Control Plane v4.1 Aether Sync — Next.js 16.3.5 + SQLite WAL + SSE + Zustand + PWA + i18n + vitest 12/12",
  "stack": ["Next.js 16", "React 19", "SQLite WAL", "SSE", "Zustand", "Tailwind 4", "R3F"],
  "category": "services",
  "status": "active",
  "version": "v4.1.0",
  "deploy": "self-hosted",
  "health": "/api/mc/health",
  "features": ["orb living", "kanban dnd-kit", "agents grid", "live-ops", "analytics 8 charts", "audit immutable", "backup VACUUM INTO", "PWA", "i18n", "API v1"],
  "dox": true,
  "updated": "2026-09-26"
}
```

### Regenerate

```bash
node update-version.js
# atau
npm run data:regenerate
```

## PR Message

```
chore(data): add niu-mission-control v4.1 Aether Sync — 113 projects tracked

- Next.js 16.3.5 / SQLite WAL / SSE / Zustand / Tailwind 4 / R3F
- PWA offline + i18n 100 keys + vitest 12/12 + a11y 7/7 + API v1 alias + budget kill-switch
- DOX v4.0 compliance: AGENTS.md + .githooks + docs reorg + .nvmrc 22
- Deploy: Docker 4.1 + LaunchAgent + systemd + backup VACUUM INTO daily 3AM retention 30d

Inventory: 112 → 113 projects
```

## Verification

- [ ] `npm run build` atau `node update-version.js` regenerate
- [ ] Check `public/data/` JSON valid
- [ ] GH Pages deploy success

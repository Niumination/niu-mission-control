# Niumination Mission Control v3.0

**Personal AI OS Dashboard** — rebuild dari nol berbasis [APEX-UI](https://github.com/RubenM1990/APEX-UI).

## 🚀 Quick Start

```bash
# 1. Install dependencies
cd services/niu-mission-control/apex-ui
npm install

# 2. Dev server (localhost:3000)
npm run dev

# 3. Production build
npm run build && npm start
```

## 🏗️ Arsitektur

| Layer | Teknologi | Status |
|---|---|---|
| **Frontend** | Next.js 15 + React 19 + R3F (Three.js) | ✅ Live |
| **Orb Visual** | SVG/CSS hand-written + WebGL shader | ✅ |
| **Reasoning Web** | SVG node graph (5-agent swarm) | ✅ |
| **API Routes** | Next.js Server Routes (`/api/*`) | 🔨 In Progress |
| **Backend Legacy** | FastAPI `server.py` | ❌ Dihapus (snapshot di `legacy-ui` branch) |

## 👥 Agent Swarm (5 Agents)

| Agent | Key | Role | Status |
|---|---|---|---|
| **Hermes Chief** | `chief` | Orchestrator & Leader | 🟢 Online |
| **Research** | `research` | Research & Learn | 🟢 Online |
| **Programmer** | `programmer` | Programmer & Coder | 🟢 Online |
| **QA Tester** | `qa` | Tester & QA | 🟢 Online |
| **Kreator** | `creator` | Content Creator | 🟢 Online |

## 📁 Struktur Repo

```
services/niu-mission-control/
├── apex-ui/                  # Next.js app (main UI)
│   ├── app/
│   │   ├── api/weather/      # Example API route
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ApexWorld.tsx     # Main screen (orb + reasoning web)
│   │   ├── ReasoningWeb.jsx  # SVG agent graph
│   │   ├── ApexOrb.jsx       # SVG orb core
│   │   ├── ApexHeroOrb.tsx   # R3F 3D orb (lazy loaded)
│   │   ├── ApexCore3D.jsx    # Particle system
│   │   ├── ApexOverviewPanel.tsx  # Top-left HUD
│   │   ├── OrbStatusBar.jsx  # Bottom status bar
│   │   └── ShaderBackground.jsx  # WebGL plasma waves
│   ├── package.json
│   └── next.config.mjs
├── docs/
│   ├── adr/                  # Architecture Decision Records
│   ├── REFACTOR_COMPLETION_PLAN.md
│   └── CREDITS.md            # APEX-UI upstream attribution
├── legacy-ui/                # Branch: snapshot codebase lama (v2.x)
└── .github/workflows/        # CI pending
```

## 🔄 Cutover Status

| Item | Status |
|---|---|
| Refactor apex-monorepo | ✅ Selesai (commit `10e1fbd`) |
| Roster Niumination 5-agent | ✅ Applied |
| Branding (title, description) | ✅ Updated |
| Build test (next build) | ✅ Pass |
| Dev server test (localhost:3000) | ✅ HTTP 200 |
| Legacy code saved | ✅ Branch `legacy-ui` @ `1962edf` |
| Tag v3.0.0 | ✅ Created |
| CI workflow | ⏳ TODO (need update) |
| LaunchAgent production | ⏳ TODO |

## 📜 History

- **v2.x**: FastAPI + vanilla dashboard (legacy, see branch `legacy-ui`)
- **v3.0.0**: Next.js + R3F + apex-ui (current)

## 📎 Attribution

Based on [APEX-UI](https://github.com/RubenM1990/APEX-UI) (MIT License). See `apex-ui/CREDITS.md` for full attribution.

---

**Docs**: `docs/adr/` · **Legacy**: branch `legacy-ui` · **Status**: v3.0.0 ready

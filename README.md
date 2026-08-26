# Niu-MissionControl

> Dashboard operasional ekosistem Niumination — ORB 3D, telemetry agent, kanban, terminal, 12 panel realtime.

![Python](https://img.shields.io/badge/Python-3.11+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Apa ini?

Niu-MissionControl adalah pusat komando (command center) untuk ekosistem Niumination. Menyediakan:

- **Mission Core 3D** — ORB gold/cyan fullscreen dengan reasoning graph 5 agent, telemetry live, dan state `standby`/`processing`/`degraded`
- **12 Floating Windows** — Dashboard, Ecosystem, Swarm, Task Kanban, Terminal, Telegram, Storage, Skill Bank, Skill Market, System, Cost, Deploy
- **WebSocket realtime** — swarm topology, live telemetry
- **Skill Monitor** — integritas SHA-256, deteksi conflict, stale skills
- **WCAG 2.1 AA** — aksesibilitas penuh (focus ring, keyboard nav, kontras, reduced-motion)

## Quickstart

```bash
cd services/niu-mission-control

# 1. Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Copy environment config
cp .env.example .env
# Edit .env — isi MC_API_KEY, TELEGRAM_BOT_TOKEN, dll.

# 3. Run
python server.py
# → http://localhost:5200
```

## Arsitektur

```
niu-mission-control/
├── server.py               # FastAPI app (single-file, ~1700 baris)
├── dashboard/              # Frontend (vanilla HTML/CSS/JS + build_unified.py)
│   ├── build_unified.py    # Generator: 12 halaman → index.html
│   ├── app.js              # Business logic (agent cards, kanban, telemetry)
│   ├── styles.css          # Dark glassmorphism theme (WCAG 2.1 AA)
│   ├── orb.html / orb.js   # Mission Core Three.js + live telemetry
│   ├── reasoning-web.js    # SVG topology 5 agent + accessible detail dialog
│   ├── apex-adaptation.css # Gold/cyan visual layer + reduced-motion fallback
│   └── static/             # Font Awesome assets
├── modules/                # Backend modules
│   ├── hermes_bridge.py    # Hermes CLI bridge (terminal + Telegram)
│   ├── hermes_status.py    # Gateway status detection
│   ├── skill_monitor.py    # Skill bank integrity (SHA-256)
│   ├── dispatch_store.py   # Thread ↔ dispatch sync
│   └── ecosystem_scanner.py # Ecosystem filesystem scanner
├── data/                   # Runtime data (NOT committed)
├── tests/                  # pytest (44 tests)
└── .env.example            # Environment config template
```

## API Endpoints

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/` | GET | Unified dashboard |
| `/health` | GET | Health check |
| `/api/mc/system` | GET | System info |
| `/api/mc/hermes` | GET | Hermes gateway status |
| `/api/mc/agents` | GET | Agent fleet status |
| `/api/mc/tasks` | GET | Task kanban |
| `/api/mc/skills` | GET | Skill bank monitor |
| `/api/mc/skills/conflicts` | GET | Skill conflicts |
| `/api/mc/directive` | GET | Telegram thread data |
| `/api/mc/dispatch` | POST | Dispatch task ke Hermes |
| `/ws/swarm` | WS | Live swarm topology |

## Adaptasi APEX-UI

Visual **Mission Core** mengadaptasi pola orb + reasoning graph dari [RubenM1990/APEX-UI](https://github.com/RubenM1990/APEX-UI) (MIT) tanpa membawa runtime Next.js/React-nya. Implementasi ditulis ulang dalam stack vanilla repo ini dan dihubungkan ke `/api/mc/agents` serta `/ws/swarm`, sehingga node yang tampil adalah fleet Niumination nyata—bukan roster demo APEX.

Lihat [ADR-004](docs/adr/004-apex-ui-adaptation.md) untuk keputusan arsitektur dan [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) untuk atribusi/lisensi.

## Testing

```bash
cd services/niu-mission-control
venv/bin/pytest tests/ -q
```

## Security

- API key auth pada semua `/api/*` endpoints
- Terminal: allowlist read-only commands, `shell=False` (no injection)
- Rate limiting: 60 req/min per IP
- `.env` tidak di-commit (ada di `.gitignore`)

## License

MIT — Niumination Ecosystem

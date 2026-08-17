# ADR-003: Monorepo Structure

**Status:** Accepted  
**Date:** 2026-08-17

## Decision

Pisah monorepo: `backend/` + `frontend/` + `deploy/` + `docs/`

## Rationale

1. **Backend & frontend punya siklus deploy berbeda** — backend = Python, frontend = static files
2. **Testing terisolasi** — backend tests (pytest) vs frontend tests (browser)
3. **Deploy flexibility** — backend bisa di-container, frontend bisa di CDN
4. **IDE support** — Python di backend, HTML/JS/CSS di frontend → linting/autocomplete lebih baik

## Target Structure

```
niu-mission-control/
├── backend/
│   ├── app/
│   │   ├── main.py            # app factory
│   │   ├── core/              # auth, config, logging
│   │   ├── routers/           # per-domain API routes
│   │   ├── services/          # business logic
│   │   └── db/                # repository, schema
│   ├── tests/
│   └── pyproject.toml
├── frontend/                  # pindah dari dashboard/
│   ├── app.js
│   ├── styles.css
│   ├── build_unified.py
│   ├── orb.html
│   └── static/
├── deploy/                    # Dockerfile, docker-compose
├── docs/                      # ADR, ARCHITECTURE.md
└── README.md
```

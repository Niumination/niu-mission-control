# Reference — Builderz Mission Control

**URL:** https://github.com/builderz-labs/mission-control  
**Takeaway:** Self-hosted AI agent control plane, Next.js 16+React 19+TS+SQLite(WAL)+better-sqlite3+Tailwind+Zustand+Recharts+xterm.js, WebSocket+SSE+REST+MCP+CLI, RBAC viewer/operator/admin, quality gates Aegis, Zod validation, session cookies+API keys+Google sign-in. Arsitektur: Web UI/CLI/MCP → auth → dispatch/events/policy/receipts → SQLite + runtimes. Cocok untuk 1-20 agents. Docker deploy, zero external deps (SQLite only).

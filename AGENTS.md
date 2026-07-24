# Niu-MissionControl — Agent Swarm

Berdasarkan NotebookLM "mission-control" spec.

## Swarm Topology (4 Agents)

| ID | Name | Role | Telegram Topic |
|----|------|------|----------------|
| `chief` | Hermes Chief | Orchestrator / Commander | 1 (General) |
| `research` | Agent 01 | Research & Learn | 802 (MC-Research) |
| `programmer` | Agent 02 | Programmer & Coder | 803 (MC-Programmer) |
| `qa` | Agent 03 | Tester & QA | 804 (MC-QA) |

Commander (user) memantau & berinteraksi langsung via dashboard + Telegram.
Agent bekerja **paralel** — Chief delegate, 3 agent eksekusi bersamaan.

## Worker Implementation
- `swarm/worker.py` — parallel asyncio loops per agent (Chief → Research → Programmer → QA)
- `swarm/bus.py` — SwarmBus: aiosqlite + asyncio.Queue + WAL (USB-safe)
- `swarm/agents.py` — AGENT_CONFIG + system prompts

## Telegram Bridge (Jalur 1)
- `modules/hermes_bridge.py` → `hermes send` CLI (HERMES_HOME=/Volumes/.../data)
- Delegate → topic 802/803/804 → Hermes Gateway → agent execute
- Agent callback: `POST /api/mc/task-update` (update status completed)

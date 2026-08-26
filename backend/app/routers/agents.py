"""Agents router — migrasi dari server.py."""

from __future__ import annotations

import os
import sys

_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter  # noqa: E402

router = APIRouter(prefix="/api/mc", tags=["agents"])

_bus = None


async def _get_bus():
    global _bus
    if _bus is None:
        from swarm.bus import bus

        await bus.init_db()
        _bus = bus
    return _bus


# Agent config (dari server.py)
AGENT_CONFIG = {
    "chief": {"name": "Hermes Chief", "model": "big-pickle", "role": "orchestrator"},
    "research": {
        "name": "Research Agent",
        "model": "gemini/gemma-4-26b",
        "role": "researcher",
    },
    "programmer": {
        "name": "Programmer Agent",
        "model": "cf/deepseek-r1",
        "role": "developer",
    },
    "qa": {"name": "QA Agent", "model": "cf/zai-org/glm-4.5-air", "role": "tester"},
    "creator": {
        "name": "Creator Agent",
        "model": "gemini/gemma-4-26b",
        "role": "content creator",
    },
}


@router.get("/agents")
async def agents_status():
    """Agent fleet status."""
    bus = await _get_bus()
    try:
        tasks = await bus.get_tasks()
        agent_tasks = {}
        for t in tasks:
            agent = t.get("agent", "unknown")
            if agent not in agent_tasks:
                agent_tasks[agent] = {
                    "total": 0,
                    "running": 0,
                    "completed": 0,
                    "failed": 0,
                }
            agent_tasks[agent]["total"] += 1
            status = t.get("status", "pending")
            if status == "running":
                agent_tasks[agent]["running"] += 1
            elif status == "completed":
                agent_tasks[agent]["completed"] += 1
            elif status == "failed":
                agent_tasks[agent]["failed"] += 1

        result = []
        for agent_id, config in AGENT_CONFIG.items():
            stats = agent_tasks.get(
                agent_id, {"total": 0, "running": 0, "completed": 0, "failed": 0}
            )
            result.append(
                {
                    "id": agent_id,
                    "name": config["name"],
                    "model": config["model"],
                    "role": config["role"],
                    "status": "active" if stats["running"] > 0 else "idle",
                    **stats,
                }
            )
        return {"agents": result}
    except Exception as e:
        return {"agents": [], "error": str(e)}

"""Cost router — migrasi dari server.py."""

from __future__ import annotations

import os
import sys

_root = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter  # noqa: E402

router = APIRouter(prefix="/api/mc", tags=["cost"])

_bus = None


async def _get_bus():
    global _bus
    if _bus is None:
        from swarm.bus import bus

        await bus.init_db()
        _bus = bus
    return _bus


@router.get("/cost/agents")
async def cost_agents():
    """Cost breakdown per agent."""
    bus = await _get_bus()
    try:
        return await bus.get_agent_costs()
    except Exception as e:
        return {"agents": [], "error": str(e)}


@router.get("/cost/task/{task_id}")
async def cost_task(task_id: str):
    """Cost per task."""
    bus = await _get_bus()
    try:
        costs = await bus.get_agent_costs()
        return {"task_id": task_id, "costs": costs}
    except Exception as e:
        return {"task_id": task_id, "error": str(e)}


@router.get("/cost/agent/{agent_id}")
async def cost_agent(agent_id: str):
    """Cost per agent."""
    bus = await _get_bus()
    try:
        costs = await bus.get_agent_costs(agent_id=agent_id)
        return {"agent_id": agent_id, "costs": costs}
    except Exception as e:
        return {"agent_id": agent_id, "error": str(e)}

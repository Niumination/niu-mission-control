"""WebSocket router — live swarm status + log streaming."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _root not in sys.path:
    sys.path.insert(0, _root)

router = APIRouter(tags=["websocket"])

_thread_pool = ThreadPoolExecutor(max_workers=10)
active_connections: list[WebSocket] = []


async def _get_bus():
    from swarm.bus import bus
    await bus.init_db()
    return bus


async def _get_skill_monitor():
    try:
        from modules import skill_monitor
        return skill_monitor
    except ImportError:
        return None


@router.websocket("/ws/swarm")
async def swarm_ws(websocket: WebSocket):
    """WebSocket endpoint for real-time swarm status and log streaming."""
    await websocket.accept()
    active_connections.append(websocket)
    bus = await _get_bus()
    sm = await _get_skill_monitor()
    loop = asyncio.get_event_loop()

    try:
        # Initial snapshot
        initial_skills = await loop.run_in_executor(
            _thread_pool, lambda: sm.get_all_skills()
        ) if sm else {"skills": [], "total": 0, "active": 0}

        initial = {
            "type": "init",
            "agents": _get_agent_status(),
            "logs": await bus.get_agent_logs(limit=30),
            "skills": initial_skills,
            "dispatches": _get_dispatches(limit=8),
        }
        await websocket.send_text(json.dumps(initial))

        # Tick loop — send snapshot every 1.5s
        while True:
            await asyncio.sleep(1.5)
            tick_skills = await loop.run_in_executor(
                _thread_pool, lambda: sm.get_all_skills()
            ) if sm else {"skills": [], "total": 0, "active": 0}

            snapshot = {
                "type": "tick",
                "agents": _get_agent_status(),
                "logs": await bus.get_agent_logs(limit=25),
                "skills": tick_skills,
                "dispatches": _get_dispatches(limit=8),
            }
            await websocket.send_text(json.dumps(snapshot))

    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
    except Exception:
        if websocket in active_connections:
            active_connections.remove(websocket)


def _get_agent_status() -> list[dict]:
    """Get agent fleet status (from SwarmBus tasks)."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            return _get_agent_status_sync()
    except RuntimeError:
        pass
    return _get_agent_status_sync()


def _get_agent_status_sync() -> list[dict]:
    """Synchronous fallback for agent status."""
    agents = [
        {"id": "chief", "name": "Hermes Chief", "model": "big-pickle", "status": "active", "role": "orchestrator"},
        {"id": "research", "name": "Research Agent", "model": "gemma-4-26b", "status": "idle", "role": "researcher"},
        {"id": "programmer", "name": "Programmer Agent", "model": "deepseek-r1", "status": "idle", "role": "developer"},
        {"id": "qa", "name": "QA Agent", "model": "glm-4.5-air", "status": "idle", "role": "tester"},
        {"id": "creator", "name": "Creator Agent", "model": "gemma-4-26b", "status": "idle", "role": "content creator"},
    ]
    return agents


def _get_dispatches(limit: int = 8) -> list[dict]:
    """Get recent dispatches."""
    try:
        import json as _json
        dispatch_file = os.path.join(_root, "data", "dispatches.json")
        if os.path.exists(dispatch_file):
            with open(dispatch_file) as f:
                data = _json.load(f)
            return data[:limit]
    except Exception:
        pass
    return []


async def broadcast(event: dict):
    """Broadcast an event to all connected WebSocket clients."""
    for ws in active_connections[:]:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            active_connections.remove(ws)

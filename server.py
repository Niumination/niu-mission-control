"""
Hermes Mission Control — FastAPI Server
Berdasarkan spesifikasi NotebookLM "mission-control" (24 Jul 2026)

Fitur:
- REST API: system health, agent status, task kanban, logs
- WebSocket: live multi-terminal stream (swarm execution feed)
- 3-Column Command Grid dashboard

Jalankan: uvicorn server:app --host 0.0.0.0 --port 5200
"""

import asyncio
import json
import logging
import os
import platform
import psutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from swarm.bus import bus
from swarm.agents import list_agents, AGENT_CONFIG
from swarm.worker import start_swarm_workers, get_agent_status

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mission-control")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_DIR = os.path.join(BASE_DIR, "dashboard")

app = FastAPI(title="Hermes Mission Control", version="2.0.0")

# WebSocket connections untuk broadcast live feed
active_connections: list[WebSocket] = []


@app.on_event("startup")
async def startup():
    await start_swarm_workers()
    logger.info("Mission Control server started on port 5200")


# ── REST API ──────────────────────────────────────────────

@app.get("/api/mc/system")
async def system_health():
    """System health: RAM, CPU, USB I/O."""
    return {
        "hostname": platform.node(),
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory": {
            "total_gb": round(psutil.virtual_memory().total / 1e9, 1),
            "used_gb": round(psutil.virtual_memory().used / 1e9, 1),
            "percent": psutil.virtual_memory().percent,
        },
        "disk": {
            "total_gb": round(psutil.disk_usage("/").total / 1e9, 1),
            "free_gb": round(psutil.disk_usage("/").free / 1e9, 1),
            "percent": psutil.disk_usage("/").percent,
        },
        "wal_mode": True,
        "status": "OK",
    }


@app.get("/api/mc/hermes")
async def hermes_real_status():
    """Real Hermes Agent status: gateway, cron, herdr agents."""
    from modules.hermes_status import get_all
    return get_all()


@app.get("/api/mc/agents")
async def agents_status():
    """Agent swarm status cards (real-time, dari herdr kalau jalan)."""
    agents = list_agents()
    runtime_status = get_agent_status()
    herdr = None
    try:
        from modules.hermes_status import herdr_agents
        herdr = herdr_agents()
    except Exception:
        herdr = None
    for a in agents:
        status = runtime_status.get(a["id"], "idle")
        # Jika herdr jalan, override status dari herdr
        if herdr and herdr.get("running"):
            # Map: cek apakah agent id ada di list herdr
            a["herdr_linked"] = True
        else:
            a["herdr_linked"] = False
        a["status"] = status
    return {"agents": agents, "swarm_active": "3 / 3 Workers", "herdr": herdr}


@app.get("/api/mc/tasks")
async def tasks_kanban():
    """Task queue untuk Kanban board."""
    tasks = await bus.get_tasks()
    columns = {"pending": [], "running": [], "completed": [], "failed": []}
    for t in tasks:
        columns.get(t["status"], columns["completed"]).append(t)
    return columns


@app.get("/api/mc/logs")
async def logs_feed(agent: str = None, limit: int = 50):
    """Live agent log feed."""
    logs = await bus.get_agent_logs(agent_id=agent, limit=limit)
    return {"logs": logs}


@app.post("/api/mc/task-update")
async def task_update(payload: dict):
    """
    Endpoint untuk agent Hermes update status task.
    Agent panggil saat selesai eksekusi:
    curl -X POST http://localhost:5200/api/mc/task-update \
      -d '{"task_id":"ac643df3","status":"completed","result":"..."}'
    """
    task_id = payload.get("task_id")
    status = payload.get("status", "completed")
    result = payload.get("result")

    if not task_id:
        return {"error": "task_id required"}

    await bus.update_task_status(task_id, status, result={"output": result} if result else None)
    agent = "chief"
    level = "INFO" if status == "completed" else "ERROR"
    await bus.log_event(
        task_id, agent, level,
        f"Task {status} via callback: {str(result)[:200] if result else ''}"
    )
    return {"status": "updated", "task_id": task_id}


@app.post("/api/mc/delegate")
async def delegate_task(payload: dict):
    """
    Chief mendelegasikan task ke agent.
    Body: {"agent": "research", "instruction": "...", "parent_id": null}
    Jalur 1: Kirim ke Telegram → Hermes Gateway → Agent execute → report balik.
    """
    agent = payload.get("agent", "research")
    instruction = payload.get("instruction", "")
    if agent not in AGENT_CONFIG:
        return {"error": f"Unknown agent: {agent}"}

    # Map agent → Telegram topic ID (IDs dari createForumTopic, auto-generated)
    topic_map = {"chief": "1", "research": "802", "programmer": "803", "qa": "804"}

    task_id = await bus.create_task(
        agent, {"instruction": instruction}, parent_id=payload.get("parent_id")
    )

    # Kirim instruksi ke Hermes via Telegram bridge (Jalur 1)
    from modules.hermes_bridge import send_chat

    # Sertakan callback URL agar agent bisa update status
    callback = f"http://localhost:5200/api/mc/task-update"
    bridge_msg = (
        f"[MC Swarm] Agent {agent} (task_id: {task_id}): {instruction}\n"
        f"Setelah selesai, update status via: "
        f"curl -s -X POST {callback} -H 'Content-Type: application/json' "
        f"-d '{{\"task_id\":\"{task_id}\",\"status\":\"completed\",\"result\":\"<ringkasan>\"}}'"
    )
    result = send_chat(bridge_msg, topic_id=topic_map.get(agent, "1"))

    if result["status"] == "sent":
        await bus.log_event(
            task_id, "chief", "INFO",
            f"Delegasi ke {agent} via Telegram: {instruction}"
        )
        await bus.update_task_status(task_id, "running")
    else:
        await bus.log_event(
            task_id, "chief", "ERROR",
            f"Gagal kirim ke Telegram: {result.get('message')}"
        )

    return {
        "task_id": task_id,
        "status": "dispatched" if result["status"] == "sent" else "failed",
        "bridge": result,
    }


# ── WebSocket: Live Multi-Terminal Feed ──────────────────

@app.websocket("/ws/swarm")
async def swarm_ws(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        # Kirim snapshot awal
        initial = {
            "type": "init",
            "agents": get_agent_status(),
            "logs": await bus.get_agent_logs(limit=20),
        }
        await websocket.send_text(json.dumps(initial))

        while True:
            # Poll status + new logs setiap 1 detik, broadcast
            await asyncio.sleep(1)
            snapshot = {
                "type": "tick",
                "agents": get_agent_status(),
                "logs": await bus.get_agent_logs(limit=10),
            }
            await websocket.send_text(json.dumps(snapshot))
    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception as e:
        logger.error("WS error: %s", e)
        if websocket in active_connections:
            active_connections.remove(websocket)


# ── Dashboard ─────────────────────────────────────────────

@app.get("/")
async def index():
    return FileResponse(os.path.join(DASHBOARD_DIR, "index.html"))


# Static files (js, css)
if os.path.exists(DASHBOARD_DIR):
    app.mount("/static", StaticFiles(directory=DASHBOARD_DIR), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5200)

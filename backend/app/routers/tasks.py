"""Tasks router — migrasi dari server.py, delegasi ke SwarmBus."""
from __future__ import annotations

import os
import sys
from datetime import datetime

# Add root to path for swarm/ import
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/mc", tags=["tasks"])

# Lazy import bus (hindari circular import saat startup)
_bus = None

async def _get_bus():
    global _bus
    if _bus is None:
        from swarm.bus import bus
        await bus.init_db()
        _bus = bus
    return _bus


@router.get("/tasks")
async def tasks_kanban():
    """Task queue for Kanban board."""
    bus = await _get_bus()
    tasks = await bus.get_tasks()
    columns: dict[str, list] = {
        "pending": [],
        "running": [],
        "completed": [],
        "failed": [],
    }
    for t in tasks:
        status = t["status"] if t["status"] in columns else "completed"
        columns[status].append(t)
    return columns


@router.get("/logs")
async def logs_feed(agent: str = None, limit: int = 50):
    """Live agent log feed."""
    bus = await _get_bus()
    logs = await bus.get_agent_logs(agent_id=agent, limit=limit)
    return {"logs": logs}


@router.get("/errors")
async def errors_count():
    """Error count from Hermes errors.log for today."""
    try:
        path = "/Volumes/HermesAgent/HermesAgentUSB/data/logs/errors.log"
        today = datetime.now().strftime("%Y-%m-%d")
        count = 0
        last_lines = []
        if os.path.exists(path):
            with open(path, encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if line.startswith(today) and "ERROR" in line:
                        count += 1
                        last_lines.append(line.strip()[-160:])
        return {"count": count, "today": today, "recent": last_lines[-5:]}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/task-update")
async def task_update(payload: dict):
    """Agent updates task status."""
    bus = await _get_bus()
    task_id = payload.get("task_id")
    status = payload.get("status", "completed")
    result = payload.get("result")

    if not task_id:
        return JSONResponse({"error": "task_id required"}, status_code=400)

    res_payload = {"output": result} if isinstance(result, str) else result
    await bus.update_task_status(task_id, status, result=res_payload)

    tasks = await bus.get_tasks()
    matched_task = next((t for t in tasks if t["task_id"] == task_id), None)
    agent = matched_task["agent"] if matched_task else "chief"

    level = "INFO" if status == "completed" else "ERROR"
    summary = str(result)[:200] if result else "Tanpa deskripsi"
    await bus.log_event(task_id, agent, level, f"Task {status} via callback: {summary}")
    return {"status": "updated", "task_id": task_id}


@router.post("/delegate")
async def delegate_task(payload: dict):
    """Delegate task to agent."""
    import json
    import asyncio
    bus = await _get_bus()
    agent = payload.get("agent")
    instruction = payload.get("instruction")
    parent_id = payload.get("parent_id")

    if not agent or not instruction:
        return JSONResponse({"error": "agent and instruction required"}, status_code=400)

    # Load topic map
    topic_map = {"chief": "1", "research": "802", "programmer": "803", "qa": "804", "creator": "1172"}
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "swarm_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path) as f:
                cfg = json.load(f)
                if "telegram_topics" in cfg:
                    tg = cfg["telegram_topics"]
                    topic_map = {
                        "chief": tg.get("general", "1"),
                        "research": tg.get("research", "802"),
                        "programmer": tg.get("programmer", "803"),
                        "qa": tg.get("qa", "804"),
                        "creator": tg.get("creator", "1172"),
                    }
        except Exception:
            pass

    task_id = await bus.create_task(agent, {"instruction": instruction}, parent_id=parent_id)

    from modules.hermes_bridge import send_chat
    callback = "http://localhost:5200/api/mc/task-update"
    bridge_msg = (
        f"[MC Swarm] Agent {agent.upper()} (task_id: {task_id}): {instruction}\n"
        f"Setelah selesai, update status via:\n"
        f"curl -s -X POST {callback} -H 'Content-Type: application/json' "
        f"-d '{{\"task_id\":\"{task_id}\",\"status\":\"completed\",\"result\":\"<ringkasan>\"}}'"
    )
    result = send_chat(bridge_msg, topic_id=topic_map.get(agent, "1"))

    if result["status"] == "sent":
        await bus.log_event(task_id, "chief", "INFO", f"Delegasi ke {agent} sukses")
        await bus.update_task_status(task_id, "running")
        if result.get("simulated"):
            async def simulate():
                await asyncio.sleep(4)
                await bus.update_task_status(task_id, "completed", result={"output": "Simulated completion"})
            asyncio.create_task(simulate())
    else:
        await bus.log_event(task_id, "chief", "ERROR", f"Gagal kirim: {result.get('message')}")
        await bus.update_task_status(task_id, "failed")

    return {"task_id": task_id, "status": "dispatched" if result["status"] == "sent" else "failed"}


@router.post("/clear-logs")
async def clear_logs():
    """Clear all logs and tasks from SwarmBus SQLite."""
    bus = await _get_bus()
    try:
        await bus._db.execute("DELETE FROM agent_logs")
        await bus._db.execute("DELETE FROM tasks")
        await bus._db.commit()
        return {"status": "success", "message": "Logs cleared"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

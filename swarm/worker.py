"""
Swarm Worker Loops
Berdasarkan spesifikasi NotebookLM "mission-control" (24 Jul 2026)

Setiap agent berjalan sebagai asyncio task terpisah. Chief menerima instruksi,
memecah menjadi task, dan mendelegasikan ke Research → Programmer → QA.

Alur: Research tulis spec → Programmer tulis kode → QA jalankan test.
Tidak ada dua agent yang berebut write access ke file yang sama.
"""

import asyncio
import logging
from swarm.bus import bus
from swarm.agents import AGENT_CONFIG

logger = logging.getLogger("swarm.worker")

# Status runtime agent (di-update real-time untuk dashboard)
AGENT_STATUS = {aid: "idle" for aid in AGENT_CONFIG.keys()}


async def _set_status(agent_id: str, status: str):
    AGENT_STATUS[agent_id] = status
    AGENT_CONFIG[agent_id]["status"] = status


async def research_agent_worker(bus_instance):
    """Worker Loop untuk Agent 01 (Research)."""
    queue = bus_instance.queues["research"]
    while True:
        task_id = await queue.get()
        try:
            await _set_status("research", "thinking")
            await bus_instance.update_task_status(task_id, "running")
            await bus_instance.log_event(
                task_id, "research", "INFO", "Mulai menyusun blueprint di /tmp..."
            )

            # Simulasi pembuatan blueprint (real: panggil LLM/tool)
            await asyncio.sleep(2)  # Asynchronous non-blocking delay
            blueprint = {
                "spec_path": "/tmp/hermes_research/active_spec.md",
                "recommendation": "Gunakan FastAPI + SQLite WAL",
            }

            await bus_instance.update_task_status(
                task_id, "completed", result=blueprint
            )
            await bus_instance.log_event(
                task_id, "research", "INFO", "Blueprint selesai dibuat."
            )
            await _set_status("research", "idle")
        except Exception as e:
            await bus_instance.update_task_status(
                task_id, "failed", result={"error": str(e)}
            )
            await bus_instance.log_event(
                task_id, "research", "ERROR", f"Gagal menyusun blueprint: {str(e)}"
            )
            await _set_status("research", "idle")
        finally:
            queue.task_done()


async def programmer_agent_worker(bus_instance):
    """Worker Loop untuk Agent 02 (Programmer)."""
    queue = bus_instance.queues["programmer"]
    while True:
        task_id = await queue.get()
        try:
            await _set_status("programmer", "executing")
            await bus_instance.update_task_status(task_id, "running")
            await bus_instance.log_event(
                task_id, "programmer", "INFO", "Menulis modul kode..."
            )

            await asyncio.sleep(2)
            # Real: tulis file berdasar blueprint dari research

            await bus_instance.update_task_status(task_id, "completed")
            await bus_instance.log_event(
                task_id, "programmer", "INFO", "Kode selesai ditulis."
            )
            await _set_status("programmer", "idle")
        except Exception as e:
            await bus_instance.update_task_status(
                task_id, "failed", result={"error": str(e)}
            )
            await bus_instance.log_event(
                task_id, "programmer", "ERROR", f"Gagal menulis kode: {str(e)}"
            )
            await _set_status("programmer", "idle")
        finally:
            queue.task_done()


async def qa_agent_worker(bus_instance):
    """Worker Loop untuk Agent 03 (QA/Tester)."""
    queue = bus_instance.queues["qa"]
    while True:
        task_id = await queue.get()
        try:
            await _set_status("qa", "executing")
            await bus_instance.update_task_status(task_id, "running")
            await bus_instance.log_event(
                task_id, "qa", "INFO", "Menjalankan test suite..."
            )

            await asyncio.sleep(2)
            # Real: jalankan pytest / test script

            await bus_instance.update_task_status(task_id, "completed")
            await bus_instance.log_event(
                task_id, "qa", "INFO", "Test PASSED (3/3)."
            )
            await _set_status("qa", "idle")
        except Exception as e:
            await bus_instance.update_task_status(
                task_id, "failed", result={"error": str(e)}
            )
            await bus_instance.log_event(
                task_id, "qa", "ERROR", f"Test FAILED: {str(e)}"
            )
            await _set_status("qa", "idle")
        finally:
            queue.task_done()


async def start_swarm_workers():
    """Jalankan semua worker agent secara paralel di background."""
    await bus.init_db()
    asyncio.create_task(research_agent_worker(bus))
    asyncio.create_task(programmer_agent_worker(bus))
    asyncio.create_task(qa_agent_worker(bus))
    logger.info("Swarm workers started: research, programmer, qa")


def get_agent_status() -> dict:
    return dict(AGENT_STATUS)

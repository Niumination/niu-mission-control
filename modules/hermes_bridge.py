"""
Hermes Bridge — Niu-MissionControl ke Hermes Gateway
=====================================================

Modul ini menyediakan jembatan komunikasi dari Niu-MC Dashboard
ke Hermes Gateway untuk mengirim pesan ke Telegram dan menjalankan
perintah shell dari dashboard.

CARA KERJA:
- Chat: Mengirim pesan ke Hermes gateway process via environment
- Terminal: Menjalankan perintah shell dengan timeout
- Cron: Trigger cron job via Hermes CLI
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import shlex
from typing import Any, Optional

logger = logging.getLogger("hermes_bridge")

HERMES_CLI = "/Users/zaryu/.hermes-portable/venv/bin/hermes"  # absolute path
HERMES_HOME = os.environ.get(
    "HERMES_HOME",
    "/Volumes/HermesAgent/HermesAgentUSB/data",  # lokasi .env + config.yaml
)
TELEGRAM_CHAT_ID = os.environ.get(
    "HERMES_TELEGRAM_CHAT_ID",
    "-REDACTED_CHAT_ID",  # Niu-MissionControl group chat ID
)
TELEGRAM_TOPIC_PREFIX = "thread:"


def _run_hermes_send(text: str, topic_id: str = "1") -> dict:
    """Kirim pesan ke Telegram via hermes send CLI (reuse gateway credential)."""
    try:
        target = f"telegram:{TELEGRAM_CHAT_ID}:{topic_id}"
        env = dict(os.environ)
        env["HERMES_HOME"] = HERMES_HOME
        r = subprocess.run(
            [HERMES_CLI, "send", "-t", target, text],
            capture_output=True,
            text=True,
            timeout=30,
            env=env,
        )
        if r.returncode == 0 and "sent" in r.stdout.lower():
            return {"status": "sent", "message": "Pesan terkirim ke Telegram"}
        return {"status": "error", "message": r.stderr[:200] or r.stdout[:200]}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def _find_hermes_home() -> Optional[str]:
    """Cari HERMES_HOME dari environment dengan fallback."""
    hermes_home = os.environ.get("HERMES_HOME", "")
    if hermes_home and os.path.isdir(hermes_home):
        return hermes_home

    # Fallback: guess dari lokasi umum
    candidates = [
        os.path.expanduser("~/.hermes"),
        os.path.expanduser("~/.config/hermes"),
        "/Volumes/HermesAgent/.cache/unix-home/.hermes",
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return None


def send_chat(
    text: str,
    topic_id: str = "1",
    target: Optional[str] = None,
) -> dict[str, Any]:
    """Kirim pesan chat ke Telegram via Hermes gateway.

    Args:
        text: Teks pesan yang akan dikirim
        topic_id: Telegram topic ID (1-7)
        target: Platform target (default: Telegram)

    Returns:
        Dict dengan status pengiriman
    """
    if not text:
        return {"status": "error", "message": "Pesan kosong"}

    # Cari persona topic
    persona_map = {
        "1": "general",
        "2": "builder",
        "3": "pengawas",
        "4": "arsitek",
        "5": "penjaga",
        "6": "scribe",
        "7": "reach",
    }
    persona = persona_map.get(topic_id, "general")

    # Kirim via hermes send CLI (reuse gateway credential)
    result = _run_hermes_send(text, topic_id)
    if result["status"] == "sent":
        return {
            "status": "sent",
            "persona": persona,
            "topic_id": topic_id,
            "message": "Pesan terkirim",
        }
    return {
        "status": "error",
        "persona": persona,
        "message": result["message"],
    }


def run_terminal(cmd: str, timeout: int = 15) -> dict[str, Any]:
    """Jalankan perintah shell dan return output.

    Args:
        cmd: Perintah shell
        timeout: Max detik (default 15)

    Returns:
        Dict dengan output/error
    """
    if not cmd:
        return {"status": "error", "output": "Perintah kosong"}

    try:
        r = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "status": "ok" if r.returncode == 0 else "error",
            "output": r.stdout[:2000] + (r.stderr[:500] if r.stderr else ""),
            "exit_code": r.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "output": f"Timeout ({timeout}s)"}
    except Exception as e:
        return {"status": "error", "output": str(e)}


def get_activity_log(limit: int = 20) -> list[dict[str, Any]]:
    """Ambil log aktivitas terkini dari agent_log.db.

    Args:
        limit: Jumlah baris maksimal

    Returns:
        List aktivitas
    """
    try:
        from modules.agent_log import get_recent
        return get_recent(limit=limit)
    except ImportError:
        return []
    except Exception as e:
        logger.error(f"Gagal baca activity log: {e}")
        return []

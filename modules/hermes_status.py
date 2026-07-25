"""Hermes Status — baca data REAL dari Hermes Agent (gateway, cron, herdr).

Internal connection: MC server → hermes_bridge → hermes CLI → gateway.
External connection: hermes CLI → Telegram gateway → Hermes Agent.

Fungsi ini dieksekusi sebagai subprocess dengan fallback mock data yang realistis 
jika CLI tidak terpasang (untuk kenyamanan development dan demo).
"""
from __future__ import annotations
import json
import logging
import os
import shutil
import subprocess
import time
from typing import Any, Optional

logger = logging.getLogger("hermes_status")

HERMES_CLI_DEFAULT = "/Users/zaryu/.hermes-portable/venv/bin/hermes"
HERMES_HOME = os.environ.get("HERMES_HOME", "/Volumes/HermesAgent/HermesAgentUSB/data")

# Cari path CLI yang valid (check default path, lalu check PATH system)
HERMES_CLI = HERMES_CLI_DEFAULT if os.path.exists(HERMES_CLI_DEFAULT) else (shutil.which("hermes") or "hermes")

# Simple in-memory cache (hindari spam CLI tiap poll)
_cache: dict[str, Any] = {}
_cache_ttl: dict[str, float] = {}
CACHE_SECONDS = 5


def _is_cli_available() -> bool:
    """Cek apakah Hermes CLI benar-benar terinstall dan bisa dieksekusi."""
    if os.path.exists(HERMES_CLI_DEFAULT):
        return True
    return shutil.which("hermes") is not None


def _cached(key: str) -> Optional[dict]:
    if key in _cache and (time.time() - _cache_ttl.get(key, 0)) < CACHE_SECONDS:
        return _cache[key]
    return None


def _run(cmd: list[str], timeout: int = 5) -> dict:
    if not _is_cli_available():
        return {"rc": -2, "out": "", "err": "Hermes CLI not found"}
        
    env = dict(os.environ)
    env["HERMES_HOME"] = HERMES_HOME
    env["HOME"] = "/Users/zaryu"
    try:
        r = subprocess.run(
            [HERMES_CLI, *cmd],
            capture_output=True, text=True, timeout=timeout, env=env,
        )
        return {"rc": r.returncode, "out": r.stdout, "err": r.stderr}
    except subprocess.TimeoutExpired:
        return {"rc": -1, "out": "", "err": f"timeout {timeout}s"}
    except Exception as e:
        return {"rc": -2, "out": "", "err": str(e)}


def gateway_status() -> dict:
    cached = _cached("gw")
    if cached:
        return cached
        
    if not _is_cli_available():
        # Fallback Mock Data yang realistis
        data = {
            "online": True,
            "raw": "PID 41203 | supervised | active (SIMULATED)",
            "pid": 41203,
            "simulated": True
        }
    else:
        res = _run(["gateway", "status"])
        online = "PID" in res["out"] and "supervised" in res["out"]
        data = {
            "online": online,
            "raw": res["out"].strip()[:300],
            "pid": None,
            "simulated": False
        }
        import re
        m = re.search(r"PID (\d+)", res["out"])
        if m:
            data["pid"] = int(m.group(1))
            
    _cache["gw"] = data
    _cache_ttl["gw"] = time.time()
    return data


def cron_jobs() -> dict:
    cached = _cached("cron")
    if cached:
        return cached
        
    if not _is_cli_available():
        # Fallback Mock Data
        jobs = [
            {
                "id": "e3057bbfa742",
                "status": "active",
                "name": "Market Sentiment Analysis",
                "schedule": "0 */4 * * *",
                "repeat": "always",
                "next_run": "In 1 hour 42 minutes",
                "last_run": "3 hours ago",
                "last_status": "ok",
                "script": "python3 scripts/sentiment_scan.py"
            },
            {
                "id": "423fbc06ea12",
                "status": "active",
                "name": "Git Backup Sync",
                "schedule": "*/30 * * * *",
                "repeat": "always",
                "next_run": "In 12 minutes",
                "last_run": "18 minutes ago",
                "last_status": "ok",
                "script": "git push origin main"
            },
            {
                "id": "0d826a7e029c",
                "status": "paused",
                "name": "Weekly Log Compactor",
                "schedule": "0 0 * * 0",
                "repeat": "always",
                "next_run": "Next Sunday 00:00",
                "last_run": "Last Sunday 00:00",
                "last_status": "ok",
                "script": "vacuum_db.sh"
            }
        ]
        data = {
            "count": len(jobs),
            "jobs": jobs,
            "raw": "Mocked cron listing",
            "simulated": True
        }
    else:
        res = _run(["cron", "list"])
        jobs = []
        import re
        blocks = re.split(r"\n\s*(?=[0-9a-f]{12}\s)", res["out"])
        for b in blocks[1:]:
            lines = b.strip().split("\n")
            if not lines:
                continue
            job_id = lines[0].split()[0] if lines[0].split() else ""
            active = "[active]" in lines[0]
            name = schedule = ""
            for ln in lines[1:]:
                if "Name:" in ln:
                    name = ln.split("Name:")[1].strip()
                elif "Schedule:" in ln:
                    schedule = ln.split("Schedule:")[1].strip()
            jobs.append({
                "id": job_id, 
                "status": "active" if active else "paused", 
                "name": name, 
                "schedule": schedule,
                "last_status": "ok"
            })
        data = {
            "count": len(jobs), 
            "jobs": jobs, 
            "raw": res["out"].strip()[:200],
            "simulated": False
        }
        
    _cache["cron"] = data
    _cache_ttl["cron"] = time.time()
    return data


def herdr_agents() -> dict:
    """Status agent herdr (jika herdr server jalan)."""
    cached = _cached("herdr")
    if cached:
        return cached
        
    if not _is_cli_available():
        # Fallback Mock Data
        data = {
            "running": True,
            "agents": [
                {"name": "builder", "status": "active", "tab": "Builder Pane", "pane": "0"},
                {"name": "pengawas", "status": "idle", "tab": "Monitor Pane", "pane": "1"},
                {"name": "arsitek", "status": "active", "tab": "Architect Pane", "pane": "2"},
                {"name": "penjaga", "status": "idle", "tab": "Security Pane", "pane": "3"}
            ],
            "simulated": True
        }
    else:
        res = _run(["agent", "list"], timeout=5)
        if res["rc"] != 0 or "refused" in res["err"].lower():
            data = {"running": False, "agents": [], "error": "herdr server not running", "simulated": False}
        else:
            agents = []
            for ln in res["out"].split("\n"):
                if ln.strip():
                    # Parse name, status, etc
                    parts = ln.strip().split()
                    name = parts[0] if len(parts) > 0 else "agent"
                    status = parts[1] if len(parts) > 1 else "unknown"
                    agents.append({"name": name, "status": status})
            data = {"running": True, "agents": agents, "simulated": False}
            
    _cache["herdr"] = data
    _cache_ttl["herdr"] = time.time()
    return data


def get_all() -> dict:
    return {
        "gateway": gateway_status(),
        "cron": cron_jobs(),
        "herdr": herdr_agents(),
    }

"""Hermes Status — baca data REAL dari Hermes Agent (gateway, cron, herdr).

Internal connection: MC server → hermes_bridge → hermes CLI → gateway.
External connection: hermes CLI → Telegram gateway → Hermes Agent.

Fungsi ini dieksekusi sebagai subprocess (slow, butuh timeout + cache).
"""
from __future__ import annotations
import json
import logging
import os
import subprocess
from typing import Any, Optional

logger = logging.getLogger("hermes_status")

HERMES_CLI = "/Users/zaryu/.hermes-portable/venv/bin/hermes"
HERMES_HOME = os.environ.get("HERMES_HOME", "/Volumes/HermesAgent/HermesAgentUSB/data")

# Simple in-memory cache (hindari spam CLI tiap poll)
_cache: dict[str, Any] = {}
_cache_ttl: dict[str, float] = {}
CACHE_SECONDS = 30


def _cached(key: str) -> Optional[dict]:
    import time
    if key in _cache and (time.time() - _cache_ttl.get(key, 0)) < CACHE_SECONDS:
        return _cache[key]
    return None


def _run(cmd: list[str], timeout: int = 12) -> dict:
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
    res = _run(["gateway", "status"])
    online = "PID" in res["out"] and "supervised" in res["out"]
    data = {
        "online": online,
        "raw": res["out"].strip()[:300],
        "pid": None,
    }
    # extract PID
    import re
    m = re.search(r"PID (\d+)", res["out"])
    if m:
        data["pid"] = int(m.group(1))
    _cache["gw"] = data
    import time
    _cache_ttl["gw"] = time.time()
    return data


def cron_jobs() -> dict:
    cached = _cached("cron")
    if cached:
        return cached
    res = _run(["cron", "list"])
    jobs = []
    # parse table: id [active/inactive] Name Schedule
    import re
    # Match: <id> [active] blocks
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
        jobs.append({"id": job_id, "active": active, "name": name, "schedule": schedule})
    data = {"count": len(jobs), "jobs": jobs, "raw": res["out"].strip()[:200]}
    _cache["cron"] = data
    import time
    _cache_ttl["cron"] = time.time()
    return data


def herdr_agents() -> dict:
    """Status agent herdr (jika herdr server jalan)."""
    cached = _cached("herdr")
    if cached:
        return cached
    res = _run(["agent", "list"], timeout=8)
    if res["rc"] != 0 or "refused" in res["err"].lower():
        data = {"running": False, "agents": [], "error": "herdr server not running"}
    else:
        # parse agent list
        agents = []
        for ln in res["out"].split("\n"):
            if ln.strip():
                agents.append(ln.strip())
        data = {"running": True, "agents": agents}
    _cache["herdr"] = data
    import time
    _cache_ttl["herdr"] = time.time()
    return data


def get_all() -> dict:
    return {
        "gateway": gateway_status(),
        "cron": cron_jobs(),
        "herdr": herdr_agents(),
    }

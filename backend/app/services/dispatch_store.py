"""
Dispatch Store — Niu-MissionControl
===================================
Tracking perintah antar-thread (general → QA/programmer/research/kreator).
Penyimpanan: JSON file (data/dispatches.json) — ringan, tanpa migrasi schema.

Setiap dispatch record:
    {
        "id": "uuid",
        "ts": "2026-08-14T21:55:00.000",
        "from": "general",
        "to": "804",
        "to_name": "qa",
        "message": "...",
        "status": "sent" | "error" | "pending",
        "error": "optional",
        "via": "api" | "manual"
    }
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger("dispatch_store")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISPATCH_FILE = os.path.join(BASE_DIR, "data", "dispatches.json")

# Thread → nama persona
THREAD_NAMES = {
    "1": "general",
    "802": "research",
    "803": "programmer",
    "804": "qa",
    "1172": "kreator",
}
VALID_THREADS = set(THREAD_NAMES.keys())

# Thread → Hermes session_id (untuk trigger agent via hermes -z --resume)
THREAD_SESSIONS = {
    "1": "20260718_020326_cbee9e",
    "802": "20260725_180757_8bfbcc82",
    "803": "20260725_180825_de730f23",
    "804": "20260725_180822_1ff5b715",
    "1172": "20260809_114955_fe915d35",
}

# Thread → (model, provider) — dari config.yaml channel_overrides
THREAD_MODELS = {
    "1": ("gemini/gemini-3.5-flash-lite", "9router"),
    "802": ("gc/gemini-2.5-pro", "9router"),
    "803": ("cf/@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "9router"),
    "804": ("cf/@cf/zai-org/glm-4.7-flash", "9router"),
    "1172": ("gemini/gemma-4-31b-it", "9router"),
}

_MAX_RECORDS = 200


def _load() -> list[dict[str, Any]]:
    try:
        with open(DISPATCH_FILE, encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except FileNotFoundError:
        return []
    except Exception as e:
        logger.error("Gagal baca dispatch store: %s", e)
        return []


def _save(records: list[dict[str, Any]]) -> None:
    try:
        os.makedirs(os.path.dirname(DISPATCH_FILE), exist_ok=True)
        # Prune ke max records
        records = records[-_MAX_RECORDS:]
        with open(DISPATCH_FILE, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=1)
    except Exception as e:
        logger.error("Gagal simpan dispatch store: %s", e)


def add_dispatch(
    to: str,
    message: str,
    from_agent: str = "general",
    status: str = "pending",
    error: Optional[str] = None,
    via: str = "api",
) -> dict[str, Any]:
    """Catat dispatch baru dan simpan."""
    record = {
        "id": uuid.uuid4().hex[:10],
        "ts": datetime.now().isoformat(timespec="seconds"),
        "unix": time.time(),
        "from": from_agent,
        "to": to,
        "to_name": THREAD_NAMES.get(to, "unknown"),
        "message": message[:500],
        "status": status,
        "error": error,
        "via": via,
    }
    records = _load()
    records.append(record)
    _save(records)
    return record


def update_status(
    dispatch_id: str, status: str, error: Optional[str] = None
) -> Optional[dict]:
    """Update status dispatch (misal pending → sent)."""
    records = _load()
    for r in records:
        if r.get("id") == dispatch_id:
            r["status"] = status
            if error:
                r["error"] = error
            _save(records)
            return r
    return None


def set_result(dispatch_id: str, result: str) -> Optional[dict]:
    """Simpan hasil kerja agent pada record dispatch."""
    records = _load()
    for r in records:
        if r.get("id") == dispatch_id:
            r["result"] = result[:4000]
            _save(records)
            return r
    return None


def get_dispatches(limit: int = 20) -> list[dict[str, Any]]:
    """Riwayat dispatch terbaru (descending)."""
    records = _load()
    return list(reversed(records[-limit:]))


def validate_target(thread_id: str) -> tuple[bool, str]:
    """Validasi target thread. Return (ok, error_message)."""
    if thread_id not in VALID_THREADS:
        return (
            False,
            f"Thread target tidak valid: {thread_id}. Valid: {sorted(VALID_THREADS)}",
        )
    return True, ""

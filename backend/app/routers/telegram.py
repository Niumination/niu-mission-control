"""Telegram router — migrasi dari server.py."""
from __future__ import annotations

import os
import sys
import json

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi import APIRouter

router = APIRouter(prefix="/api/mc", tags=["telegram"])


@router.get("/telegram-feed")
async def telegram_feed(limit: int = 30, topic: str = None):
    """Telegram feed from gateway logs."""
    try:
        from modules.gateway_log_parser import parse_telegram_feed
        return parse_telegram_feed(limit=limit, topic=topic)
    except Exception as e:
        return {"messages": [], "error": str(e)}


@router.post("/send-telegram")
async def send_telegram(payload: dict):
    """Send message to Telegram."""
    message = payload.get("message", "")
    topic = payload.get("topic", "1")
    if not message:
        return {"status": "error", "message": "No message provided"}
    try:
        from modules.hermes_bridge import send_chat
        result = send_chat(message, topic_id=str(topic))
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

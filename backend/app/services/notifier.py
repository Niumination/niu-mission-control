"""Telegram notifier — send status updates (service, not IPC)."""
from __future__ import annotations

import httpx

from app.core.config import get_settings


async def send_notification(message: str, chat_id: str = None) -> dict:
    """Send a notification to Telegram. Fire-and-forget."""
    cfg = get_settings()
    target = chat_id or cfg.telegram_chat_id
    token = cfg.telegram_bot_token if hasattr(cfg, "telegram_bot_token") else ""

    if not token or not target:
        return {"status": "skipped", "reason": "no token or chat_id configured"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": target, "text": message, "parse_mode": "HTML"},
            )
            return {"status": "sent", "code": resp.status_code}
    except Exception as e:
        return {"status": "error", "error": str(e)}

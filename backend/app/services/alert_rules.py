"""Alert rules — detect anomalies and notify via Telegram."""
from __future__ import annotations

import json
from datetime import datetime

from app.db.database import get_db
from app.services.notifier import send_notification


# ── Alert thresholds ───────────────────────────────────────
ALERT_RULES = {
    "agent_error_streak": {"threshold": 3, "window_hours": 1},
    "gateway_down": {"check_interval_min": 5},
    "budget_daily_exceeded": {"threshold_usd": 10.0},
    "queue_backlog": {"threshold": 20},
}


async def check_alerts() -> list[dict]:
    """Run all alert checks and return triggered alerts."""
    alerts = []
    db = await get_db()

    # 1. Agent error streak (3+ errors in 1 hour)
    cursor = await db.execute(
        "SELECT agent, COUNT(*) as err_count FROM events "
        "WHERE type='task.transition' AND payload LIKE '%failed%' "
        "AND ts > datetime('now', '-1 hour') GROUP BY agent HAVING err_count >= ?",
        (ALERT_RULES["agent_error_streak"]["threshold"],),
    )
    for row in await cursor.fetchall():
        alerts.append({
            "type": "agent_error_streak",
            "severity": "high",
            "message": f"Agent '{row['agent']}' has {row['err_count']} errors in the last hour",
        })

    # 2. Queue backlog
    cursor = await db.execute(
        "SELECT COUNT(*) as cnt FROM tasks WHERE status='queued'"
    )
    row = await cursor.fetchone()
    if row and row["cnt"] >= ALERT_RULES["queue_backlog"]["threshold"]:
        alerts.append({
            "type": "queue_backlog",
            "severity": "medium",
            "message": f"Task queue backlog: {row['cnt']} tasks waiting",
        })

    # 3. Daily budget exceeded
    cursor = await db.execute(
        "SELECT SUM(cost_usd) as total FROM cost WHERE date(ts) = date('now')"
    )
    row = await cursor.fetchone()
    if row and row["total"] and row["total"] >= ALERT_RULES["budget_daily_exceeded"]["threshold_usd"]:
        alerts.append({
            "type": "budget_exceeded",
            "severity": "high",
            "message": f"Daily budget exceeded: ${row['total']:.2f} / ${ALERT_RULES['budget_daily_exceeded']['threshold_usd']:.2f}",
        })

    # Send notifications for high-severity alerts
    for alert in alerts:
        if alert["severity"] == "high":
            await send_notification(f"🚨 <b>{alert['type']}</b>\n{alert['message']}")

    return alerts


async def get_alert_rules() -> dict:
    """Return current alert configuration."""
    return ALERT_RULES

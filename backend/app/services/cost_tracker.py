"""Cost tracker — record token/cost per task & agent."""

from __future__ import annotations

from app.db.database import get_db


async def record_cost(
    agent: str,
    model: str,
    tokens_in: int,
    tokens_out: int,
    cost_usd: float = 0.0,
    task_id: str = None,
) -> dict:
    """Record cost entry."""
    db = await get_db()
    await db.execute(
        "INSERT INTO cost (agent, model, tokens_in, tokens_out, "
        "cost_usd, task_id) VALUES (?, ?, ?, ?, ?, ?)",
        (agent, model, tokens_in, tokens_out, cost_usd, task_id),
    )
    await db.commit()
    return {"status": "recorded", "agent": agent, "model": model}


async def get_cost_summary(period: str = "today") -> dict:
    """Get cost summary for a period."""
    db = await get_db()
    if period == "today":
        cursor = await db.execute(
            "SELECT agent, model, SUM(tokens_in) as total_in, "
            "SUM(tokens_out) as total_out, SUM(cost_usd) as total_cost "
            "FROM cost WHERE date(ts) = date('now') GROUP BY agent, model"
        )
    else:
        cursor = await db.execute(
            "SELECT agent, model, SUM(tokens_in) as total_in, "
            "SUM(tokens_out) as total_out, SUM(cost_usd) as total_cost "
            "FROM cost GROUP BY agent, model"
        )
    rows = await cursor.fetchall()
    return {"period": period, "breakdown": [dict(r) for r in rows]}

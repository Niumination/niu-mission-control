"""SSE fallback — for environments that block WebSocket."""

from __future__ import annotations

import asyncio
import json
import time
from fastapi import Request
from fastapi.responses import StreamingResponse


async def sse_endpoint(request: Request, room: str = "fleet"):
    """SSE endpoint as WS fallback."""
    from app.services.ws_hub import get_ws_hub

    hub = get_ws_hub()

    async def event_stream():
        last_idx = max(0, len(hub.event_log) - 10)
        while True:
            if await request.is_disconnected():
                break
            # Send new events since last check
            new_events = hub.event_log[last_idx:]
            for event in new_events:
                yield f"data: {json.dumps(event)}\n\n"
            last_idx = len(hub.event_log)
            # Heartbeat every 30s
            yield f": heartbeat {int(time.time())}\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

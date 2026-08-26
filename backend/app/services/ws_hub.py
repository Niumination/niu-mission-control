"""WebSocket hub — rooms, subscribe, broadcast, replay."""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import WebSocket


class WSHub:
    """WebSocket hub with rooms, event replay, and heartbeat."""

    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)
        self.event_log: list[dict] = []  # in-memory event log for replay
        self.max_log = 1000

    async def connect(self, ws: WebSocket, rooms: list[str] = None):
        """Accept and register a WebSocket connection."""
        await ws.accept()
        rooms = rooms or ["fleet"]
        for room in rooms:
            self.connections[room].add(ws)
        # Send recent events for replay
        for event in self.event_log[-50:]:
            try:
                await ws.send_json(event)
            except Exception:
                pass

    def disconnect(self, ws: WebSocket, rooms: list[str] = None):
        """Remove a WebSocket from all rooms."""
        for room in rooms or list(self.connections.keys()):
            self.connections[room].discard(ws)

    async def broadcast(self, room: str, event: dict):
        """Broadcast an event to all connections in a room."""
        event["ts"] = time.time()
        self.event_log.append(event)
        if len(self.event_log) > self.max_log:
            self.event_log = self.event_log[-self.max_log :]

        dead = set()
        for ws in self.connections.get(room, set()):
            try:
                await ws.send_json(event)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.connections[room].discard(ws)

    def get_stats(self) -> dict:
        return {
            "rooms": {room: len(conns) for room, conns in self.connections.items()},
            "total_connections": sum(len(c) for c in self.connections.values()),
            "event_log_size": len(self.event_log),
        }


# ── Singleton ──────────────────────────────────────────────
_hub: WSHub | None = None


def get_ws_hub() -> WSHub:
    global _hub
    if _hub is None:
        _hub = WSHub()
    return _hub

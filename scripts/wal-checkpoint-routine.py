#!/usr/bin/env python3
"""Routine WAL checkpoint untuk USB-safe mode."""
import asyncio, sqlite3, sys
sys.path.insert(0, "/home/user/niu-mission-control")
from swarm.bus import bus

async def checkpoint():
    await bus.init()
    await bus._db.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    await bus._db.commit()
    print("WAL checkpoint truncated.")

if __name__ == "__main__":
    asyncio.run(checkpoint())

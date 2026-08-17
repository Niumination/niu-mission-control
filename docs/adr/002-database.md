# ADR-002: Database & State

**Status:** Accepted  
**Date:** 2026-08-17

## Decision

**SQLite + WAL** sebagai database utama. Tidak ada Redis/NATS.

## Rationale

1. **Zero-dep** — SQLite sudah ada di Python stdlib
2. **USB-safe** — tidak perlu server terpisah, bisa dibawa ke USB
3. **WAL mode** — concurrent read/write tanpa lock contention
4. **Sudah terbukti** — mission_control.db, swarm_state.db, kanban.db sudah pakai SQLite
5. **Repository pattern** — bisa upgrade ke Postgres nanti tanpa ubah service layer

## Consequences

- Single-node only (OK untuk sekarang)
- Tidak ada pub/sub bawaan (diasumsikan via asyncio.Queue + WS hub)
- Backup = copy file .db

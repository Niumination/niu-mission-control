# ADR-006: SSE for Realtime Dashboard Feeds

**Status:** Accepted  
**Date:** 2026-09-24  
**Deciders:** Afrizal Munthe

## Context

Dashboard butuh realtime updates: task lifecycle (queued→running→review→done), agent status (online/working/idle/offline), approvals, alerts, cost. Pilihan: polling, WebSocket, SSE, gRPC.

## Decision

**SSE (Server-Sent Events) sebagai default untuk dashboard feeds**, dengan fallback polling 10s jika SSE gagal. WebSocket optional untuk bidirectional control channel (future, tidak di v4.0).

Endpoint: `GET /api/mc/events` → `text/event-stream`, headers no-cache keep-alive, replay via `Last-Event-ID` header, filter `?types=task.*,agent.*`.

EventBus in-process singleton via `globalThis.__mc_event_bus__` agar survive Next.js dev HMR reload (tanpa ini dispatcher instance lama vs SSE route instance baru → event hilang).

Client: `useEventStream()` singleton guard ref, EventSource, exponential backoff reconnect, update Zustand stores (agents, tasks, health, activity), activity max 200 + prependHistory dedup, fallback polling.

## Rationale

- **Zylos.ai research:** SSE default untuk dashboard feeds (auto-reconnect Last-Event-ID, proxy-friendly, HTTP plain, tidak perlu upgrade), WebSocket untuk bidirectional control channel, gRPC/OTLP untuk agent-to-collector.
- **Proxy-friendly:** SSE plain HTTP, bekerja di reverse proxy, Tailscale, Caddy, tanpa perlu WebSocket upgrade yang kadang di-block.
- **Simpler:** Tidak perlu ws package, tidak perlu handle binary frames, hanya `data: JSON\n\n` + `id: \n`.
- **Replay:** `replaySince(lastEventId)` SELECT id > lastEventId ORDER BY id ASC, `latest(limit)` untuk init.
- **Single-process:** EventBus in-memory + persist ke SQLite `events` table (id autoincrement, aggregate_type, aggregate_id, event_type, payload JSON, actor, created_at) untuk audit & replay.

## Consequences

- Positif: <100ms delivery dari state change, auto-reconnect, replay event terlewat, tidak perlu polling manual, orb & reasoning web reacts to events bukan timer acak, activity feed update tanpa refresh.
- Negatif: Unidirectional (server→client) saja, tidak bisa client→server via same channel (butuh POST terpisah). Untuk v4.0 ini cukup karena client→server via REST dispatch.
- Trade-off: Jika butuh bidirectional control (terminal attach), WebSocket akan ditambah di future, tapi SSE tetap untuk feeds.

## Alternatives

- **Polling 3s:** Simple tapi latency tinggi, waste resource, tidak realtime.
- **WebSocket only:** Lebih kompleks, perlu handle upgrade, proxy kadang block, untuk unidirectional feeds overkill.
- **gRPC/OTLP:** Untuk agent-to-collector, bukan untuk browser dashboard.

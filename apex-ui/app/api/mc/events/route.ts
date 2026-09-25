/**
 * GET /api/mc/events — Server-Sent Events stream.
 *
 * Versi ini pakai ReadableStream + controller langsung (lebih kompatibel dengan
 * Next.js App Router edge/node runtimes) tanpa TransformStream.
 */

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/server/auth'
import { eventBus, type McEvent } from '@/lib/server/events'
import db from '@/lib/server/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'

const HEARTBEAT_MS = 30_000
const MAX_REPLAY = 500

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function formatSse(event: McEvent): string {
  return [
    `event: ${event.event_type}`,
    `id: ${event.id}`,
    `data: ${JSON.stringify({
      id: event.id,
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      type: event.event_type,
      payload: event.payload,
      actor: event.actor ?? null,
      created_at: event.created_at,
    })}`,
    '',
    '',
  ].join('\n')
}

function buildSnapshot(): Record<string, unknown> {
  try {
    const agents = db.prepare(
      `SELECT id, name, role, color, status, model_default as model,
              (SELECT COUNT(*) FROM tasks WHERE assigned_agent = agents.id AND status NOT IN ('done','failed','cancelled')) as active_tasks
       FROM agents WHERE enabled = 1 ORDER BY name`
    ).all()

    const counts = db.prepare(`
      SELECT status, COUNT(*) as c FROM tasks
      WHERE status IN ('inbox','queued','running','review')
      GROUP BY status
    `).all() as { status: string; c: number }[]
    const queue: Record<string, number> = { inbox: 0, queued: 0, running: 0, review: 0 }
    for (const r of counts) queue[r.status] = r.c

    const workerTick = (db.prepare(`SELECT value FROM app_settings WHERE key='worker_last_tick'`).get() as { value: string } | undefined)?.value ?? null

    return {
      timestamp: new Date().toISOString(),
      agents,
      queue,
      worker_last_tick: workerTick,
    }
  } catch (err) {
    return { error: String(err), timestamp: new Date().toISOString() }
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status || 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const lastEventIdHeader = req.headers.get('last-event-id')
  const lastEventId = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) || 0 : 0

  let closed = false
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller

      const send = (text: string) => {
        if (closed || !controllerRef) return
        try {
          controllerRef.enqueue(encode(text))
        } catch {
          cleanup()
        }
      }

      const onEvent = (ev: McEvent) => send(formatSse(ev))

      // Connected comment
      send(`: connected ${new Date().toISOString()}\n\n`)

      // Snapshot awal
      const snap = buildSnapshot()
      send(`event: snapshot\nid: -1\ndata: ${JSON.stringify(snap)}\n\n`)

      // Replay missed events
      if (lastEventId > 0) {
        try {
          const missed = eventBus.replaySince(lastEventId, MAX_REPLAY)
          for (const ev of missed) send(formatSse(ev))
          send(`event: replay.done\ndata: {"count":${missed.length}}\n\n`)
        } catch (err) {
          send(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`)
        }
      }

      // Subscribe
      const unsubscribe = eventBus.subscribe(onEvent)

      // Heartbeat
      const heartbeat = setInterval(() => {
        send(`: ping ${new Date().toISOString()}\n\n`)
      }, HEARTBEAT_MS)

      function cleanup() {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try { controllerRef?.close() } catch {}
        controllerRef = null
      }

      req.signal.addEventListener('abort', cleanup)
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

/**
 * Event Bus (in-process)
 * -----------------------
 * - Setiap perubahan state di sistem meng-emit event lewat `emitEvent()`.
 * - Event di-persist ke tabel `events` (untuk replay/audit).
 * - Listener in-process dapat berlangganan via `subscribe()` (digunakan
 *   oleh SSE endpoint di M3 dan notifier internal).
 *
 * Catatan arsitektur:
 * Ini event bus yang paling sederhana — single-process, in-memory,
 * dengan persistensi ke SQLite. Untuk single-node control plane
 * (tujuan v4.0), ini sudah cukup. Jika nanti butuh multi-proses,
 * dapat diganti dengan Redis Pub/Sub tanpa mengubah interface publik.
 */

import db from './db'

export interface McEvent {
  id?: number
  aggregate_type: 'task' | 'agent' | 'dispatch' | 'approval' | 'alert' | 'system'
  aggregate_id: string
  event_type: string
  payload: Record<string, unknown>
  actor?: string
  created_at?: string
}

type Listener = (event: McEvent) => void

class EventBus {
  private listeners = new Set<Listener>()

  /**
   * Subscribe ke semua event. Mengembalikan fungsi unsubscribe.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Emit event: persist ke DB, lalu broadcast ke listener in-proc.
   * Fungsi ini sinkron (INSERT ke SQLite) dan harus dipanggil di dalam
   * transaksi jika event adalah bagian dari state change multi-tabel.
   * Itulah sebabnya kami expose `persist` dan `broadcast` terpisah juga,
   * sehingga dispatcher/db-layer bisa memanggil persist di dalam transaksi
   * lalu broadcast setelah commit (menghindari subscriber melihat event
   * yang belum committed).
   */
  emit(event: McEvent): McEvent {
    const persisted = this.persist(event)
    this.broadcast(persisted)
    return persisted
  }

  /**
   * Hanya tulis ke DB, tanpa broadcast. Dipakai di dalam transaksi.
   */
  persist(event: McEvent): McEvent {
    const now = event.created_at ?? new Date().toISOString()
    const payloadStr = JSON.stringify(event.payload ?? {})
    const info = db
      .prepare(
        `INSERT INTO events (aggregate_type, aggregate_id, event_type, payload, actor, created_at)
         VALUES (@aggregate_type, @aggregate_id, @event_type, @payload, @actor, @created_at)`
      )
      .run({
        aggregate_type: event.aggregate_type,
        aggregate_id: event.aggregate_id,
        event_type: event.event_type,
        payload: payloadStr,
        actor: event.actor ?? null,
        created_at: now,
      })
    return {
      ...event,
      id: Number(info.lastInsertRowid),
      payload: event.payload,
      created_at: now,
    }
  }

  /**
   * Broadcast event ke semua listener in-memory.
   * Dipanggil setelah transaksi commit.
   */
  broadcast(event: McEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        // Jangan biarkan listener error membunuh thread utama
        console.error('[events] Listener error:', err)
      }
    }
  }

  /**
   * Replay event sejak ID tertentu (digunakan SSE client reconnect).
   */
  replaySince(lastEventId: number, limit = 1000): McEvent[] {
    const rows = db
      .prepare(
        `SELECT id, aggregate_type, aggregate_id, event_type, payload, actor, created_at
         FROM events WHERE id > ? ORDER BY id ASC LIMIT ?`
      )
      .all(lastEventId, limit) as any[]
    return rows.map(r => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : {},
    }))
  }

  /**
   * Event terbaru (untuk inisialisasi client).
   */
  latest(limit = 50): McEvent[] {
    const rows = db
      .prepare(
        `SELECT id, aggregate_type, aggregate_id, event_type, payload, actor, created_at
         FROM events ORDER BY id DESC LIMIT ?`
      )
      .all(limit) as any[]
    return rows
      .reverse()
      .map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : {} }))
  }
}

export const eventBus: EventBus = (() => {
  // Pakai globalThis agar instance EventBus tetap SAMA meskipun Next.js dev
  // server me-reload modul saat HMR. Tanpa ini, dispatcher (yang start sekali
  // saat bootstrap via instrumentation) akan memegang instance eventbus lama,
  // sementara SSE route baru subscribe ke instance baru → event hilang.
  const g = globalThis as unknown as { __mc_event_bus__?: EventBus }
  if (!g.__mc_event_bus__) {
    g.__mc_event_bus__ = new EventBus()
  }
  return g.__mc_event_bus__
})()

// ── Helper untuk operasi event umum ───────────────────────────────

export function emitTaskEvent(taskId: string, type: string, payload: Record<string, unknown>, actor?: string) {
  return eventBus.emit({
    aggregate_type: 'task',
    aggregate_id: taskId,
    event_type: type,
    payload,
    actor,
  })
}

export function emitAgentEvent(agentId: string, type: string, payload: Record<string, unknown>, actor?: string) {
  return eventBus.emit({
    aggregate_type: 'agent',
    aggregate_id: agentId,
    event_type: type,
    payload,
    actor,
  })
}

export function emitSystemEvent(type: string, payload: Record<string, unknown>, actor?: string) {
  return eventBus.emit({
    aggregate_type: 'system',
    aggregate_id: 'global',
    event_type: type,
    payload,
    actor,
  })
}

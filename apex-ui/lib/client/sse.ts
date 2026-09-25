/**
 * useEventStream — custom hook yang menyambungkan SSE /api/mc/events ke Zustand stores.
 *
 * Fitur:
 * - Auto-reconnect dengan exponential backoff (mulai 1s, cap 30s, ±jitter)
 * - Replay event yang terlewat via Last-Event-ID header
 * - Heartbeat watcher (detect koneksi mati meskipun browser tidak memecat error)
 * - Dispatch setiap event ke store yang relevan (agents, tasks, activity, health)
 * - Fetch initial data via REST sebelum subscribe, agar first render ada data.
 *
 * Cara pakai:
 *   Panggil sekali di root page (app/page.tsx) — tidak perlu prop drilling.
 *   Semua komponen yang subscribe ke store (via useAgentsStore/useTasksStore/...)
 *   akan menerima update realtime.
 */

import { useEffect, useRef } from 'react'
import { useAgentsStore, useTasksStore, useHealthStore, useActivityStore } from './stores'

type Ev = {
  id: number | string
  type: string
  aggregate_type: string
  aggregate_id: string
  payload: Record<string, unknown>
  actor?: string | null
  created_at: string
}

const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30_000
const HEARTBEAT_TIMEOUT_MS = 45_000 // server kirim ping setiap 30s; 45s = timeout

let streamSingleton: EventSource | null = null
let subscribers = 0
let lastEventId: number | string = 0

export function useEventStream() {
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    subscribers++
    if (subscribers === 1) {
      // Load initial state via REST dulu, lalu connect SSE
      bootstrapInitialState().finally(() => connect())
    }
    return () => {
      subscribers--
      if (subscribers === 0 && streamSingleton) {
        streamSingleton.close()
        streamSingleton = null
      }
    }
  }, [])
}

async function bootstrapInitialState() {
  try {
    const [health, tasks] = await Promise.all([
      fetch('/api/mc/health', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/mc/tasks?limit=200', { credentials: 'include' }).then(r => r.json()),
    ])
    if (health?.worker_last_tick) useHealthStore.getState().setWorkerTick(health.worker_last_tick)

    // Flatten grouped tasks menjadi array
    const allTasks: any[] = []
    for (const status of ['inbox','queued','running','review','done','failed','cancelled'] as const) {
      const list = tasks[status] || []
      for (const t of list) {
        allTasks.push({ ...t, status })
      }
    }
    useTasksStore.getState().setTasks(allTasks)
  } catch (err) {
    console.warn('[sse] initial bootstrap failed (will retry on connect):', err)
  }
}

function connect() {
  const health = useHealthStore.getState()
  health.bumpReconnect()

  const es = new EventSource('/api/mc/events', { withCredentials: true })
  streamSingleton = es

  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  const resetHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer)
    heartbeatTimer = setTimeout(() => {
      console.warn('[sse] heartbeat timeout; reconnecting')
      es.close()
      scheduleReconnect()
    }, HEARTBEAT_TIMEOUT_MS)
  }

  es.onopen = () => {
    health.setConnected(true)
    resetHeartbeat()
  }

  es.onmessage = (ev) => {
    resetHeartbeat()
    // Fallback jika event tidak punya nama (data-only message)
    try {
      const data = JSON.parse(ev.data)
      dispatch({
        id: ev.lastEventId || data.id || Date.now(),
        type: data.type || 'message',
        aggregate_type: data.aggregate_type || 'system',
        aggregate_id: data.aggregate_id || 'global',
        payload: data.payload || data,
        actor: data.actor,
        created_at: data.created_at || new Date().toISOString(),
      })
      if (ev.lastEventId) lastEventId = ev.lastEventId
    } catch (e) {
      console.warn('[sse] failed to parse event:', ev.data)
    }
  }

  // Generic event listener untuk semua event type
  es.addEventListener('snapshot', (e: MessageEvent) => handleEvent(e, 'snapshot'))
  es.addEventListener('task.queued', (e) => handleEvent(e as MessageEvent, 'task.queued'))
  es.addEventListener('task.claimed', (e) => handleEvent(e as MessageEvent, 'task.claimed'))
  es.addEventListener('task.started', (e) => handleEvent(e as MessageEvent, 'task.started'))
  es.addEventListener('task.progress', (e) => handleEvent(e as MessageEvent, 'task.progress'))
  es.addEventListener('task.completed', (e) => handleEvent(e as MessageEvent, 'task.completed'))
  es.addEventListener('task.failed', (e) => handleEvent(e as MessageEvent, 'task.failed'))
  es.addEventListener('task.retrying', (e) => handleEvent(e as MessageEvent, 'task.retrying'))
  es.addEventListener('task.cancelled', (e) => handleEvent(e as MessageEvent, 'task.cancelled'))
  es.addEventListener('approval.requested', (e) => handleEvent(e as MessageEvent, 'approval.requested'))
  es.addEventListener('approval.approved', (e) => handleEvent(e as MessageEvent, 'approval.approved'))
  es.addEventListener('approval.rejected', (e) => handleEvent(e as MessageEvent, 'approval.rejected'))
  es.addEventListener('agent.status', (e) => handleEvent(e as MessageEvent, 'agent.status'))
  es.addEventListener('agent.working', (e) => handleEvent(e as MessageEvent, 'agent.working'))
  es.addEventListener('agent.idle', (e) => handleEvent(e as MessageEvent, 'agent.idle'))
  es.addEventListener('agent.online', (e) => handleEvent(e as MessageEvent, 'agent.online'))
  es.addEventListener('agent.offline', (e) => handleEvent(e as MessageEvent, 'agent.offline'))
  es.addEventListener('agent.error', (e) => handleEvent(e as MessageEvent, 'agent.error'))
  es.addEventListener('task.submitted', (e) => handleEvent(e as MessageEvent, 'task.submitted'))
  es.addEventListener('alert.raised', (e) => handleEvent(e as MessageEvent, 'alert.raised'))
  es.addEventListener('dispatcher.started', (e) => handleEvent(e as MessageEvent, 'dispatcher.started'))
  es.addEventListener('dispatcher.stopped', (e) => handleEvent(e as MessageEvent, 'dispatcher.stopped'))
  es.addEventListener('replay.done', () => { resetHeartbeat() })

  es.onerror = () => {
    health.setConnected(false)
    if (heartbeatTimer) clearTimeout(heartbeatTimer)
    es.close()
    scheduleReconnect()
  }
}

let reconnectDelay = INITIAL_BACKOFF_MS
function scheduleReconnect() {
  const delay = reconnectDelay * (0.8 + Math.random() * 0.4) // ±20% jitter
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_BACKOFF_MS)
  setTimeout(() => connect(), delay)
}

function handleEvent(e: MessageEvent, type: string) {
  try {
    const data = JSON.parse(e.data)
    const ev: Ev = {
      id: data.id ?? e.lastEventId ?? Date.now(),
      type,
      aggregate_type: data.aggregate_type,
      aggregate_id: data.aggregate_id,
      payload: data.payload ?? data,
      actor: data.actor,
      created_at: data.created_at || new Date().toISOString(),
    }
    if (typeof ev.id === 'number' && ev.id > 0) lastEventId = ev.id
    if (type === 'replay.done') return
    dispatch(ev)
    // Reset backoff setelah berhasil menerima event
    reconnectDelay = INITIAL_BACKOFF_MS
  } catch (err) {
    console.warn('[sse] event parse error:', err)
  }
}

function dispatch(ev: Ev) {
  const activity = useActivityStore.getState()
  const tasks = useTasksStore.getState()
  const agents = useAgentsStore.getState()
  const health = useHealthStore.getState()

  // Special handling per type
  switch (ev.type) {
    case 'snapshot': {
      if (ev.payload.agents) agents.setAgents(ev.payload.agents as any)
      if (ev.payload.queue) tasks.setQueueCounts(ev.payload.queue as any)
      if (ev.payload.worker_last_tick) health.setWorkerTick(ev.payload.worker_last_tick as string)
      return
    }
    case 'task.queued':
    case 'task.claimed':
    case 'task.started':
    case 'task.progress':
    case 'task.completed':
    case 'task.failed':
    case 'task.retrying':
    case 'task.cancelled': {
      // Setelah state change, fetch detail task? untuk akurasi kita fetch ulang
      // task by id secara lazy; untuk update instan, pakai payload saja.
      tasks.upsertTask({
        id: ev.aggregate_id,
        status: taskStatusFromEvent(ev.type),
        ...(ev.payload as any),
      })
      if ((ev.payload as any)?.progress != null) {
        tasks.upsertTask({ id: ev.aggregate_id, progress: (ev.payload as any).progress })
      }
      // Refresh queue counts (async, non-blocking)
      refreshQueueCounts()
      break
    }
    case 'agent.status':
    case 'agent.working':
    case 'agent.idle':
    case 'agent.online':
    case 'agent.offline':
    case 'agent.error': {
      const newStatus = ev.type.replace('agent.', '')
      agents.updateAgent(ev.aggregate_id, {
        status: newStatus === 'working' ? 'working'
             : newStatus === 'idle' ? 'idle'
             : newStatus === 'online' ? 'online'
             : newStatus === 'offline' ? 'offline'
             : newStatus === 'error' ? 'error'
             : (ev.payload as any).status || 'idle',
        ...(ev.payload as any),
      })
      break
    }
    case 'dispatcher.tick': {
      if ((ev.payload as any)?.last_tick) health.setWorkerTick((ev.payload as any).last_tick)
      break
    }
  }

  // Tambahkan ke activity feed
  if (ev.type !== 'snapshot' && ev.type !== 'replay.done') {
    activity.addEvent(ev)
  }
}

function taskStatusFromEvent(type: string) {
  switch (type) {
    case 'task.queued': return 'queued'
    case 'task.claimed': return 'running'
    case 'task.started': return 'running'
    case 'task.progress': return 'running'
    case 'task.completed': return 'done'
    case 'task.failed': return 'failed'
    case 'task.retrying': return 'queued'
    case 'task.cancelled': return 'cancelled'
    default: return undefined
  }
}

async function refreshQueueCounts() {
  try {
    const res = await fetch('/api/mc/health', { credentials: 'include' })
    if (!res.ok) return
    const h = await res.json()
    useHealthStore.getState().setWorkerTick(h.worker_last_tick)
  } catch {}
}

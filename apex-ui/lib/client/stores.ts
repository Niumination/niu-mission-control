/**
 * Zustand stores untuk state client-side yang disinkronkan via SSE.
 *
 * Store dibuat modular agar komponen bisa subscribe ke slice yang dibutuhkan
 * (menghindari re-render tidak perlu saat ada event tidak relevan).
 */

import { create } from 'zustand'

// ── Agent state ────────────────────────────────────────────────────

export interface AgentState {
  id: string
  name: string
  role: string
  color: string
  status: string // online|idle|working|offline|error
  model?: string
  active_tasks: number
}

interface AgentsStore {
  agents: Record<string, AgentState>
  setAgents: (list: AgentState[]) => void
  updateAgent: (id: string, patch: Partial<AgentState>) => void
  list: () => AgentState[]
}

export const useAgentsStore = create<AgentsStore>((set, get) => ({
  agents: {},
  setAgents: (list) =>
    set({
      agents: Object.fromEntries(list.map(a => [a.id, a])),
    }),
  updateAgent: (id, patch) =>
    set(state => ({
      agents: { ...state.agents, [id]: { ...(state.agents[id] || { id, name: id, role: '', color: '#00e5ff', status: 'offline', active_tasks: 0 }), ...patch } },
    })),
  list: () => Object.values(get().agents),
}))

// ── Tasks state ────────────────────────────────────────────────────

export type TaskStatus = 'inbox' | 'queued' | 'running' | 'review' | 'done' | 'failed' | 'cancelled'

export interface TaskState {
  id: string
  title: string
  description?: string | null
  assigned_agent?: string | null
  agent_name?: string | null
  agent_color?: string | null
  status: TaskStatus
  priority: 'high' | 'medium' | 'low'
  progress: number
  created_at?: string
  queued_at?: string
  started_at?: string
  completed_at?: string
  failed_at?: string
  error_message?: string | null
  result?: string | null
  retry_count?: number
  artifact_count?: number
  cost_estimate_usd?: number
}

interface TasksStore {
  tasks: Record<string, TaskState>
  queueCounts: Record<TaskStatus, number>
  setTasks: (list: TaskState[]) => void
  upsertTask: (t: Partial<TaskState> & { id: string }) => void
  setQueueCounts: (counts: Record<string, number>) => void
  listByStatus: (status: TaskStatus) => TaskState[]
  getAll: () => TaskState[]
}

export const useTasksStore = create<TasksStore>((set, get) => ({
  tasks: {},
  queueCounts: { inbox: 0, queued: 0, running: 0, review: 0, done: 0, failed: 0, cancelled: 0 },
  setTasks: (list) => {
    const tasks: Record<string, TaskState> = {}
    for (const t of list) tasks[t.id] = { ...makeDefaultTask(t), ...t }
    set({ tasks })
  },
  upsertTask: (patch) =>
    set(state => {
      const existing = state.tasks[patch.id]
      const merged = { ...(existing || makeDefaultTask(patch)), ...patch } as TaskState
      return { tasks: { ...state.tasks, [patch.id]: merged } }
    }),
  setQueueCounts: (counts) =>
    set(state => ({
      queueCounts: { ...state.queueCounts, ...counts },
    })),
  listByStatus: (status) => Object.values(get().tasks).filter(t => t.status === status),
  getAll: () => Object.values(get().tasks),
}))

function makeDefaultTask(p: Partial<TaskState> & { id: string }): TaskState {
  return {
    id: p.id,
    title: p.title ?? '(untitled)',
    status: (p.status ?? 'inbox') as TaskStatus,
    priority: (p.priority ?? 'medium') as 'medium',
    progress: p.progress ?? 0,
    assigned_agent: p.assigned_agent ?? null,
    agent_name: p.agent_name ?? null,
    description: p.description ?? null,
  }
}

// ── Health state ───────────────────────────────────────────────────

interface HealthState {
  status: 'ok' | 'degraded' | 'down' | 'connecting'
  worker_last_tick: string | null
  lastEventAt: string | null
  connected: boolean
  reconnectCount: number
  setConnected: (c: boolean) => void
  setWorkerTick: (t: string) => void
  bumpReconnect: () => void
}

export const useHealthStore = create<HealthState>((set) => ({
  status: 'connecting',
  worker_last_tick: null,
  lastEventAt: null,
  connected: false,
  reconnectCount: 0,
  setConnected: (connected) => set({ connected, status: connected ? 'ok' : 'connecting', lastEventAt: new Date().toISOString() }),
  setWorkerTick: (t) => set({ worker_last_tick: t, lastEventAt: new Date().toISOString() }),
  bumpReconnect: () => set(s => ({ reconnectCount: s.reconnectCount + 1 })),
}))

// ── Activity feed ──────────────────────────────────────────────────

export interface ActivityEvent {
  id: number | string
  type: string
  aggregate_type: string
  aggregate_id: string
  payload: Record<string, unknown>
  actor?: string | null
  created_at: string
}

interface ActivityStore {
  events: ActivityEvent[] // terbaru di akhir, kita reverse untuk render
  addEvent: (ev: ActivityEvent) => void
  prependHistory: (evs: ActivityEvent[]) => void
  clear: () => void
}

const MAX_ACTIVITY = 200

export const useActivityStore = create<ActivityStore>((set) => ({
  events: [],
  addEvent: (ev) => set(state => ({
    events: [...state.events, ev].slice(-MAX_ACTIVITY),
  })),
  prependHistory: (evs) => set(state => ({
    // Replay events yang terlewat dimasukkan di DEPAN (lebih lama),
    // jangan duplikat berdasarkan id
    events: [...evs.filter(e => !state.events.find(x => x.id === e.id)), ...state.events].slice(-MAX_ACTIVITY),
  })),
  clear: () => set({ events: [] }),
}))

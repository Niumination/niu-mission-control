'use client'

/**
 * useOrbState — derive orb state dari Zustand stores (yang diisi SSE).
 *
 * State PRD §7.1.2:
 *   'idle'      — tidak ada task running, semua agent online sehat
 *   'thinking'  — minimal 1 task running (intensity proporsional jumlah task 1-5+)
 *   'speaking'  — ada task yang baru selesai (<10 detik) atau event completion baru
 *   'alert'     — ada error (task failed / agent offline/error) atau approval pending
 *   'offline'   — semua agent offline
 *
 * Export intensity 0..3 untuk kontrol animasi partikel/boil.
 */

import { useEffect, useState } from 'react'
import { useTasksStore, useAgentsStore, useActivityStore } from '@/lib/client/stores'

export type OrbState = 'idle' | 'thinking' | 'speaking' | 'alert' | 'offline'

interface OrbStateResult {
  state: OrbState
  intensity: number // 0..3 — 0 idle, 1 lambat, 2 sedang, 3 intens
  runningTasks: number
  queueDepth: number
  errorsCount: number
  approvalsCount: number
}

const SPEAKING_WINDOW_MS = 10_000
const ALERT_COOLDOWN_MS = 8_000

export function useOrbState(): OrbStateResult {
  const tasks = useTasksStore(s => s.tasks)
  const agents = useAgentsStore(s => s.agents)
  const events = useActivityStore(s => s.events)
  const [, setTick] = useState(0)

  // Re-evaluate setiap detik (untuk window "speaking" 10d dan alert cooldown)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const runningTasks = Object.values(tasks).filter(t => t.status === 'running').length
  const queuedTasks = Object.values(tasks).filter(t => t.status === 'queued').length
  const reviewTasks = Object.values(tasks).filter(t => t.status === 'review').length
  const failedRecent = Object.values(tasks).filter(t => {
    if (t.status !== 'failed') return false
    const failedAt = t.failed_at ? new Date(t.failed_at).getTime() : 0
    return Date.now() - failedAt < ALERT_COOLDOWN_MS
  }).length

  const agentList = Object.values(agents)
  const workingAgents = agentList.filter(a => a.status === 'working').length
  const errorAgents = agentList.filter(a => a.status === 'error' || a.status === 'offline').length
  const onlineAgents = agentList.filter(a => a.status !== 'offline').length

  // Speaking window: event task.completed dalam 10 detik terakhir
  const recentCompleted = events.filter(e =>
    e.type === 'task.completed' &&
    Date.now() - new Date(e.created_at).getTime() < SPEAKING_WINDOW_MS
  ).length

  // Alert triggers
  const hasRecentFailure = failedRecent > 0
  const hasAgentError = errorAgents > 0 && agentList.length > 0 && errorAgents === agentList.length === false
  const hasApprovals = reviewTasks > 0

  let state: OrbState
  if (onlineAgents === 0 && agentList.length > 0) {
    state = 'offline'
  } else if (hasRecentFailure || hasAgentError) {
    state = 'alert'
  } else if (hasApprovals) {
    state = 'alert' // amber — approval pending
  } else if (recentCompleted > 0) {
    state = 'speaking'
  } else if (runningTasks > 0 || workingAgents > 0) {
    state = 'thinking'
  } else {
    state = 'idle'
  }

  // Intensity 0..3 berdasarkan beban
  let intensity = 0
  if (state === 'thinking') {
    const load = runningTasks + workingAgents
    if (load >= 5) intensity = 3
    else if (load >= 3) intensity = 2
    else intensity = 1
  } else if (state === 'speaking') {
    intensity = 2
  } else if (state === 'alert') {
    intensity = 3
  }

  return {
    state,
    intensity,
    runningTasks,
    queueDepth: queuedTasks + reviewTasks,
    errorsCount: failedRecent + (hasAgentError ? 1 : 0),
    approvalsCount: reviewTasks,
  }
}

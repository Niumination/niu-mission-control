'use client'

/**
 * useReasoningWebState — derive per-node state dan trace (particle flow)
 * untuk ReasoningWeb component dari SSE-updated stores.
 *
 * Return:
 *   roster: array yang siap diumpankan ke ReasoningWeb props `roster`,
 *           dengan field [id, label, layer, x, y, live, bend, r]
 *           (live = true jika agent tidak offline, ukuran r sesuai active_tasks)
 *   pulseIds: string[] — daftar agent ID yang harus "fire" (spoke particle
 *             mengalir dari node ke core, glow berdenyut) saat ini. Di-trigger
 *             oleh event agent.working / task.claimed yang baru tiba.
 *
 * ReasoningWeb coords (dari ROSTER di ReasoningWeb.jsx full mode):
 *   chief:      340, 240
 *   research:   225, 165
 *   programmer: 455, 170
 *   qa:         300, 335
 *   creator:    445, 325
 *
 * Layer mapping: chief='consultant' (besar, dekat core), specialist='doer'
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAgentsStore, useActivityStore, useTasksStore } from '@/lib/client/stores'

const COORDS: Record<string, { x: number; y: number; bend: number; r: number; layer: string }> = {
  chief:      { x: 340, y: 240, bend: 18, r: 12, layer: 'consultant' },
  research:   { x: 225, y: 165, bend: 24, r: 9,  layer: 'doer' },
  programmer: { x: 455, y: 170, bend: -24, r: 9, layer: 'doer' },
  qa:         { x: 300, y: 335, bend: 22, r: 8,  layer: 'doer' },
  creator:    { x: 445, y: 325, bend: -20, r: 8, layer: 'doer' },
}

const PULSE_DURATION_MS = 2500

export interface WebStateResult {
  roster: (string | number | boolean)[][]
  activeNodeIds: string[] // ids yang sedang bekerja (untuk badge label)
  pulseKey: number        // increment tiap pulse; ReasoningWeb trace prop pakai object dengan field n=pulseKey agar refire
  traceIds: string[]      // ids yang harus di-fire (particle burst)
}

export function useReasoningWebState(): WebStateResult {
  const agents = useAgentsStore(s => s.agents)
  const events = useActivityStore(s => s.events)
  const [pulses, setPulses] = useState<{ id: string; until: number }[]>([])
  const lastPulseCount = useRef(0)

  // Pantau event baru; jika ada task.claimed atau agent.working, picu pulse ke agent tersebut
  useEffect(() => {
    if (events.length <= lastPulseCount.current) {
      lastPulseCount.current = events.length
      return
    }
    const newOnes = events.slice(lastPulseCount.current)
    lastPulseCount.current = events.length
    const now = Date.now()
    const adds: { id: string; until: number }[] = []
    for (const ev of newOnes) {
      // Event yang memicu pulse dari agent ke core
      if (ev.type === 'task.claimed' || ev.type === 'task.started') {
        const aid = (ev.payload as any)?.agent_id
        if (aid && COORDS[aid]) adds.push({ id: aid, until: now + PULSE_DURATION_MS })
      } else if (ev.type === 'task.completed' || ev.type === 'task.failed') {
        // Pulse dari agent ke core saat selesai juga (feedback visual)
        // Cari agent dari task (sudah tersimpan di tasks store, tapi untuk simplifikasi
        // kita aktifkan chief sebagai pengirim hasil)
        adds.push({ id: 'chief', until: now + PULSE_DURATION_MS })
      } else if (ev.type === 'agent.working' || ev.type === 'agent.idle') {
        if (COORDS[ev.aggregate_id]) adds.push({ id: ev.aggregate_id, until: now + PULSE_DURATION_MS })
      } else if (ev.type === 'approval.requested') {
        adds.push({ id: 'chief', until: now + PULSE_DURATION_MS * 2 })
      }
    }
    if (adds.length) {
      setPulses(prev => [...prev.filter(p => p.until > now), ...adds])
    }
  }, [events])

  // Bersihkan pulse yang sudah expired
  useEffect(() => {
    const id = setInterval(() => {
      setPulses(prev => {
        const now = Date.now()
        const filtered = prev.filter(p => p.until > now)
        return filtered.length === prev.length ? prev : filtered
      })
    }, 500)
    return () => clearInterval(id)
  }, [])

  // Hitung jumlah task aktif (running+queued+review) per agent untuk badge count
  const tasks = useTasksStore(s => s.tasks)
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const roster = useMemo(() => {
    // Hitung jumlah active task per assigned_agent
    const countByAgent: Record<string, number> = {}
    for (const t of Object.values(tasks)) {
      const aid = t.assigned_agent
      if (!aid) continue
      if (t.status === 'running' || t.status === 'queued' || t.status === 'review') {
        countByAgent[aid] = (countByAgent[aid] || 0) + 1
      }
    }
    return Object.entries(COORDS).map(([id, c]) => {
      const a = agents[id]
      const isOffline = !a || a.status === 'offline' || a.status === 'error'
      const isWorking = a?.status === 'working'
      const live = !isOffline
      const hasTasks = (countByAgent[id] || 0) > 0
      // Radius membesar jika bekerja atau punya task
      const radius = isWorking ? c.r + 3 : hasTasks ? c.r + 1 : c.r
      const name = a?.name || (id === 'chief' ? 'Hermes Chief'
        : id === 'research' ? 'Research'
        : id === 'programmer' ? 'Programmer'
        : id === 'qa' ? 'QA Tester'
        : id === 'creator' ? 'Kreator' : id)
      // [id, label, layer, x, y, live, bend, r, count] — r[8] = badge count
      return [id, name, c.layer, c.x, c.y, live, c.bend, radius, countByAgent[id] || 0]
    })
  }, [agents, tasks])

  const activeNodeIds = Object.entries(agents)
    .filter(([, a]) => a.status === 'working')
    .map(([id]) => id)

  const traceIds = pulses.map(p => p.id)

  return {
    roster,
    activeNodeIds,
    pulseKey: pulses.length,
    traceIds,
  }
}

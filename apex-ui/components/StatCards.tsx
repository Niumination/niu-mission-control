'use client'

/**
 * StatCards — 6 mini cards di top-right panel dengan data realtime dari SSE stores.
 * Angka update sendiri saat event masuk; sparkline 60 poin (3 menit @3s tick).
 */

import { useEffect, useRef, useState } from 'react'
import { useTasksStore, useHealthStore, useAgentsStore } from '@/lib/client/stores'

interface Point { t: number; v: number }

function useSparkline(source: () => number, windowMs = 180_000, intervalMs = 3000) {
  const [points, setPoints] = useState<Point[]>([])
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setPoints(prev => {
        const cut = now - windowMs
        const next = [...prev.filter(p => p.t > cut), { t: now, v: source() }]
        return next.slice(-60)
      })
    }
    tick()
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return points
}

function Sparkline({ points, color, max }: { points: Point[]; color: string; max?: number }) {
  if (points.length < 2) return <svg width="60" height="20" />
  const w = 60, h = 20
  const vs = points.map(p => p.v)
  const maxV = max ?? Math.max(1, ...vs)
  const minV = 0
  const step = w / Math.max(1, points.length - 1)
  const d = points.map((p, i) => {
    const x = i * step
    const y = h - ((p.v - minV) / (maxV || 1)) * (h - 2) - 1
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={d} stroke={color} strokeWidth="1.2" fill="none" opacity="0.85" />
    </svg>
  )
}

interface CardProps {
  label: string
  value: string | number
  color: string
  dot?: boolean
  points?: Point[]
  sub?: string
  sparkMax?: number
}

function Card({ label, value, color, dot, points, sub, sparkMax }: CardProps) {
  return (
    <div style={{
      background: 'rgba(8,14,24,0.7)',
      border: `1px solid ${color}33`,
      borderRadius: 6,
      padding: '8px 10px',
      minWidth: 100,
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#64748b', marginBottom: 2 }}>
        {dot && (
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: color, marginRight: 5, boxShadow: `0 0 6px ${color}`,
            verticalAlign: 'middle',
          }} />
        )}
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 600, color, lineHeight: 1 }}>
          {value}
        </div>
        {points && points.length >= 2 && <Sparkline points={points} color={color} max={sparkMax} />}
      </div>
      {sub && <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function StatCards() {
  const tasks = useTasksStore(s => s.tasks)
  const health = useHealthStore(s => s.connected)
  const workersTick = useHealthStore(s => s.worker_last_tick)
  const agents = useAgentsStore(s => s.agents)

  const running = Object.values(tasks).filter(t => t.status === 'running').length
  const queued = Object.values(tasks).filter(t => t.status === 'queued' || t.status === 'inbox').length
  const review = Object.values(tasks).filter(t => t.status === 'review').length
  const failed = Object.values(tasks).filter(t => t.status === 'failed').length
  const doneToday = Object.values(tasks).filter(t => {
    if (t.status !== 'done' || !t.completed_at) return false
    return new Date(t.completed_at).toDateString() === new Date().toDateString()
  }).length
  const workingAgents = Object.values(agents).filter(a => a.status === 'working').length
  const onlineAgents = Object.values(agents).filter(a => a.status !== 'offline' && a.status !== 'error').length

  const workerAge = workersTick ? Math.floor((Date.now() - new Date(workersTick).getTime()) / 1000) : null
  const workerFresh = workerAge !== null && workerAge < 10

  const runningPts = useSparkline(() => running, 180_000, 3000)
  const queuePts = useSparkline(() => queued + review, 180_000, 3000)

  return (
    <div style={{
      position: 'absolute',
      top: 150,
      right: 20,
      zIndex: 90,
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(100px, 1fr))',
      gap: 6,
      width: 360,
      pointerEvents: 'none',
    }}>
      <Card
        label="Active"
        value={running}
        color="#00e5ff"
        dot={running > 0}
        points={runningPts}
        sub={`${workingAgents} agent${workingAgents === 1 ? '' : 's'} working`}
        sparkMax={5}
      />
      <Card
        label="Queue"
        value={queued + review}
        color="#f5a623"
        dot={queued + review > 0}
        points={queuePts}
        sub={`${review} awaiting review`}
        sparkMax={10}
      />
      <Card
        label="Done Today"
        value={doneToday}
        color="#34d399"
        dot
      />
      <Card
        label="Errors"
        value={failed}
        color={failed > 0 ? '#ef4444' : '#64748b'}
        dot={failed > 0}
      />
      <Card
        label="Agents"
        value={`${onlineAgents}/${Object.keys(agents).length || 5}`}
        color={onlineAgents === 0 ? '#ef4444' : onlineAgents < 5 ? '#f5a623' : '#34d399'}
        dot
        sub={health ? 'stream live' : 'connecting'}
      />
      <Card
        label="Worker"
        value={workerFresh ? 'live' : workerAge !== null ? `${workerAge}s` : '—'}
        color={workerFresh ? '#34d399' : '#f59e0b'}
        dot={workerFresh}
        sub={health ? '' : 'offline'}
      />
    </div>
  )
}

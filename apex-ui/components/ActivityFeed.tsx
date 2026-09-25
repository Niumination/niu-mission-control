'use client'

import { useActivityStore, type ActivityEvent } from '@/lib/client/stores'
import { useEffect, useRef } from 'react'

function timeAgo(iso: string) {
  const d = new Date(iso).getTime()
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 5) return 'now'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function eventIcon(ev: ActivityEvent): { icon: string; color: string } {
  switch (ev.type) {
    case 'task.queued':    return { icon: '→', color: '#94a3b8' }
    case 'task.claimed':   return { icon: '▶', color: '#00e5ff' }
    case 'task.started':   return { icon: '⚡', color: '#00e5ff' }
    case 'task.progress':  return { icon: '…', color: '#60a5fa' }
    case 'task.completed': return { icon: '✓', color: '#34d399' }
    case 'task.failed':    return { icon: '✕', color: '#ef4444' }
    case 'task.retrying':  return { icon: '↻', color: '#f59e0b' }
    case 'task.cancelled': return { icon: '⊘', color: '#94a3b8' }
    case 'task.submitted': return { icon: '⏸', color: '#f5a623' }
    case 'approval.requested': return { icon: '!', color: '#f5a623' }
    case 'approval.approved':  return { icon: '✓', color: '#34d399' }
    case 'approval.rejected':  return { icon: '✕', color: '#ef4444' }
    case 'agent.working':  return { icon: '●', color: '#00e5ff' }
    case 'agent.idle':     return { icon: '○', color: '#64748b' }
    case 'agent.online':   return { icon: '↑', color: '#34d399' }
    case 'agent.offline':  return { icon: '↓', color: '#64748b' }
    case 'agent.error':    return { icon: '!', color: '#ef4444' }
    case 'alert.raised':   return { icon: '⚠', color: '#ef4444' }
    case 'dispatcher.started': return { icon: '◉', color: '#34d399' }
    case 'dispatcher.stopped': return { icon: '⊗', color: '#f5a623' }
    default: return { icon: '•', color: '#94a3b8' }
  }
}

function eventLabel(ev: ActivityEvent): string {
  const p = ev.payload as any
  switch (ev.type) {
    case 'task.queued':    return `Task ${ev.aggregate_id.slice(0, 10)} queued${p.agent ? ` → ${p.agent}` : ''}`
    case 'task.claimed':   return `Task ${ev.aggregate_id.slice(0, 10)} claimed${p.agent_id ? ` by ${p.agent_id}` : ''}`
    case 'task.started':   return `Task ${ev.aggregate_id.slice(0, 10)} started`
    case 'task.completed': return `Task ${ev.aggregate_id.slice(0, 10)} completed${p.tokens ? ` · ${p.tokens} tok` : ''}`
    case 'task.failed':    return `Task ${ev.aggregate_id.slice(0, 10)} failed: ${p.error?.slice?.(0, 60) ?? 'error'}`
    case 'task.retrying':  return `Task ${ev.aggregate_id.slice(0, 10)} retrying (${p.retry_count}/${p.max_retries ?? 3})`
    case 'task.cancelled': return `Task ${ev.aggregate_id.slice(0, 10)} cancelled`
    case 'task.submitted': return `Task ${ev.aggregate_id.slice(0, 10)} submitted for approval`
    case 'approval.requested': return `Approval requested for task ${(p.task_id || ev.aggregate_id).slice(0, 10)}`
    case 'approval.approved':  return `Approved task ${(p.task_id || ev.aggregate_id).slice(0, 10)}`
    case 'approval.rejected':  return `Rejected task ${(p.task_id || ev.aggregate_id).slice(0, 10)}`
    case 'agent.working':  return `Agent ${ev.aggregate_id} working`
    case 'agent.idle':     return `Agent ${ev.aggregate_id} idle`
    case 'agent.online':   return `Agent ${ev.aggregate_id} online`
    case 'agent.offline':  return `Agent ${ev.aggregate_id} offline`
    case 'agent.error':    return `Agent ${ev.aggregate_id} error: ${p.error?.slice?.(0, 50) ?? 'err'}`
    case 'alert.raised':   return `⚠ ${p.message || 'alert'}`
    case 'dispatcher.started': return `Dispatcher started`
    case 'dispatcher.stopped': return `Dispatcher stopped`
    default: return `${ev.type} · ${ev.aggregate_id.slice(0, 10)}`
  }
}

export default function ActivityFeed({ maxItems = 20 }: { maxItems?: number }) {
  const events = useActivityStore(s => s.events)
  const listRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  // Auto-scroll ke bawah saat event baru, kecuali user sedang scroll up
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [events.length])

  const recent = events.slice(-maxItems).reverse() // terbaru di atas

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(8, 14, 24, 0.75)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(0, 229, 255, 0.15)',
      borderRadius: 8,
      overflow: 'hidden',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: '0.72rem',
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(0,229,255,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#00e5ff',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>
        <span>Activity Feed</span>
        <span style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: 0 }}>
          {events.length} events
        </span>
      </div>
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          shouldAutoScroll.current = atBottom
        }}
        style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}
      >
        {recent.length === 0 && (
          <div style={{ padding: '16px 12px', color: '#64748b', textAlign: 'center' }}>
            Waiting for events…
          </div>
        )}
        {recent.map((ev, i) => {
          const { icon, color } = eventIcon(ev)
          return (
            <div
              key={`${ev.id}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '5px 12px',
                borderLeft: '2px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                transition: 'background 0.15s',
              }}
              title={new Date(ev.created_at).toLocaleString()}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {icon}
              </span>
              <span style={{ flex: 1, color: '#cbd5e1', lineHeight: 1.3 }}>
                {eventLabel(ev)}
              </span>
              <span style={{ flexShrink: 0, color: '#475569', fontSize: '0.65rem' }}>
                {timeAgo(ev.created_at)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

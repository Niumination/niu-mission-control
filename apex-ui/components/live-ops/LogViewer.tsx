'use client'

/**
 * LogViewer — live log stream dengan filter level/agent/search, auto-scroll, pause
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { Search, Pause, Play, Trash2, Filter } from 'lucide-react'
import { useActivityStore } from '@/lib/client/stores'

interface LogEntry {
  id: string | number
  level: string
  message: string
  source?: string | null
  task_id?: string | null
  created_at: string
  type?: string // untuk event
}

interface Props {
  filterAgent: string
}

export default function LogViewer({ filterAgent }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const activityEvents = useActivityStore(s => s.events)

  // Fetch initial logs from API
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const params = new URLSearchParams()
        params.set('limit', '150')
        if (filterAgent && filterAgent !== 'all') params.set('source', filterAgent)
        if (levelFilter !== 'all') params.set('level', levelFilter)
        if (search.trim()) params.set('search', search.trim())
        const res = await fetch(`/api/mc/logs?${params.toString()}`)
        const data = await res.json()
        if (data.logs) {
          const mapped: LogEntry[] = data.logs.map((l: any) => ({
            id: `log-${l.id}`,
            level: l.level,
            message: l.message,
            source: l.source,
            task_id: l.task_id,
            created_at: l.created_at,
          }))
          // Merge dengan events sebagai logs
          const eventLogs: LogEntry[] = (data.events || []).map((e: any) => ({
            id: `ev-${e.id}`,
            level: e.event_type.includes('failed') || e.event_type.includes('error') ? 'error' : e.event_type.includes('warn') ? 'warn' : 'info',
            message: `${e.event_type} • ${e.aggregate_id}${e.payload?.title ? ` — ${e.payload.title}` : ''}`,
            source: e.payload?.agent || e.aggregate_id,
            task_id: e.aggregate_type === 'task' ? e.aggregate_id : null,
            created_at: e.created_at,
            type: e.event_type,
          }))
          const combined = [...mapped, ...eventLogs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          setLogs(combined.slice(-200))
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [filterAgent, levelFilter, search])

  // Real-time dari activity store (SSE)
  useEffect(() => {
    if (paused) return
    if (activityEvents.length === 0) return
    const last = activityEvents[activityEvents.length - 1]
    if (!last) return
    // Convert last activity event to log entry if not already present
    const exists = logs.some(l => String(l.id) === `ev-${last.id}`)
    if (exists) return
    const entry: LogEntry = {
      id: `ev-${last.id}`,
      level: last.type.includes('failed') || last.type.includes('error') ? 'error' : last.type.includes('warn') ? 'warn' : 'info',
      message: `${last.type} • ${last.aggregate_id}${(last.payload as any)?.title ? ` — ${(last.payload as any).title}` : ''}`,
      source: (last.payload as any)?.agent || last.aggregate_id,
      task_id: last.aggregate_type === 'task' ? last.aggregate_id : null,
      created_at: last.created_at,
      type: last.type,
    }
    // Filter
    if (filterAgent !== 'all' && entry.source !== filterAgent && entry.task_id) {
      // still allow if task matches? skip filtering for simplicity
    }
    setLogs(prev => [...prev, entry].slice(-200))
  }, [activityEvents, paused, filterAgent, logs])

  // Auto scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (levelFilter !== 'all' && l.level !== levelFilter) return false
      if (filterAgent !== 'all' && l.source !== filterAgent && l.task_id) {
        // allow if task_id exists? For MVP, filter only if source matches
        if (l.source && l.source !== filterAgent) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!(l.message + ' ' + (l.source || '') + ' ' + (l.task_id || '')).toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [logs, levelFilter, filterAgent, search])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: 12,
      overflow: 'hidden', fontFamily: '"JetBrains Mono", monospace',
    }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid rgba(240,237,232,0.08)',
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: 'rgba(15,23,42,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={12} color="#64748b" />
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
            style={{
              background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)',
              color: '#f0ede8', padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', fontFamily: 'inherit',
            }}>
            <option value="all">All levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', borderRadius: 6,
          background: 'rgba(240,237,232,0.04)', border: '1px solid rgba(240,237,232,0.08)',
        }}>
          <Search size={12} color="#64748b" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs…"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f0ede8', fontSize: '0.7rem', fontFamily: 'inherit', width: 120 }} />
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={() => setPaused(p => !p)} title={paused ? 'Resume' : 'Pause'}
          style={{
            padding: '4px 8px', borderRadius: 6,
            background: paused ? 'rgba(245,166,35,0.15)' : 'rgba(240,237,232,0.04)',
            border: `1px solid ${paused ? 'rgba(245,166,35,0.4)' : 'rgba(240,237,232,0.1)'}`,
            color: paused ? '#f5a623' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'inherit', fontSize: '0.65rem',
          }}>
          {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Paused' : 'Live'}
        </button>

        <button onClick={() => setLogs([])} title="Clear"
          style={{
            padding: '4px 8px', borderRadius: 6,
            background: 'transparent', border: '1px solid rgba(240,237,232,0.1)',
            color: '#64748b', cursor: 'pointer',
          }}>
          <Trash2 size={12} />
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: '#64748b', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ accentColor: '#00e5ff' }} />
          Auto-scroll
        </label>
      </div>

      {/* Logs list */}
      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {loading && <div style={{ color: '#64748b', fontSize: '0.7rem', padding: 12 }}>Loading logs…</div>}
        {!loading && filteredLogs.length === 0 && (
          <div style={{ color: '#3b4a5a', fontSize: '0.7rem', padding: 20, textAlign: 'center' }}>No logs match filter</div>
        )}
        {filteredLogs.map(entry => (
          <div key={String(entry.id)} style={{
            display: 'flex', gap: 8, padding: '5px 8px', borderRadius: 6,
            background: entry.level === 'error' ? 'rgba(239,68,68,0.06)' : entry.level === 'warn' ? 'rgba(245,166,35,0.06)' : 'transparent',
            borderLeft: `2px solid ${levelColor(entry.level)}`,
            fontSize: '0.68rem', lineHeight: 1.4,
          }}>
            <span style={{ color: '#475569', whiteSpace: 'nowrap', fontSize: '0.62rem' }}>{new Date(entry.created_at).toLocaleTimeString()}</span>
            <span style={{
              fontSize: '0.58rem', padding: '1px 5px', borderRadius: 3, height: 'fit-content',
              background: `${levelColor(entry.level)}22`, color: levelColor(entry.level),
              border: `1px solid ${levelColor(entry.level)}40`, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>{entry.level}</span>
            {entry.source && <span style={{ color: '#a855f7', whiteSpace: 'nowrap', fontSize: '0.65rem' }}>[{entry.source}]</span>}
            <span style={{ color: entry.level === 'error' ? '#fca5a5' : entry.level === 'warn' ? '#fde68a' : '#cbd5e1', flex: 1, wordBreak: 'break-word' }}>{entry.message}</span>
            {entry.task_id && <span style={{ color: '#64748b', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>{entry.task_id}</span>}
          </div>
        ))}
      </div>

      <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(240,237,232,0.06)', fontSize: '0.6rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
        <span>{filteredLogs.length} entries • {paused ? 'Paused' : 'Live streaming'}</span>
        <span>SSE + DB polling 5s</span>
      </div>
    </div>
  )
}

function levelColor(l: string): string {
  switch (l) {
    case 'error': return '#ef4444'
    case 'warn': return '#f5a623'
    case 'info': return '#00e5ff'
    case 'debug': return '#64748b'
    default: return '#94a3b8'
  }
}

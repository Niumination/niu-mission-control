'use client'

/**
 * /audit — Immutable audit log table dengan filter
 */

import { useEffect, useState } from 'react'
import { Search, Filter, Shield, Clock, User, Target, FileText, Download } from 'lucide-react'

interface AuditLog {
  id: number
  actor: string
  actor_type: string
  action: string
  target_type: string
  target_id: string
  result: string
  details: any
  client_ip: string | null
  created_at: string
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actorFilter, setActorFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [targetFilter, setTargetFilter] = useState('all')
  const [limit, setLimit] = useState(100)
  const [filtersMeta, setFiltersMeta] = useState<{ actors: string[]; actions: string[]; target_types: string[] }>({ actors: [], actions: [], target_types: [] })

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      if (search.trim()) params.set('search', search.trim())
      if (actorFilter !== 'all') params.set('actor', actorFilter)
      if (actionFilter !== 'all') params.set('action', actionFilter)
      if (targetFilter !== 'all') params.set('target_type', targetFilter)
      const res = await fetch(`/api/mc/audit?${params.toString()}`)
      const data = await res.json()
      if (data.logs) {
        setLogs(data.logs)
        setTotal(data.total)
        if (data.filters) setFiltersMeta(data.filters)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [actorFilter, actionFilter, targetFilter, limit])
  // Debounced search
  useEffect(() => {
    const id = setTimeout(fetchLogs, 400)
    return () => clearTimeout(id)
  }, [search])

  const exportCsv = () => {
    const header = ['id', 'created_at', 'actor', 'actor_type', 'action', 'target_type', 'target_id', 'result', 'client_ip']
    const rows = logs.map(l => [l.id, l.created_at, l.actor, l.actor_type, l.action, l.target_type, l.target_id, l.result, l.client_ip || ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      padding: '20px 24px 40px',
      background: '#04080f',
      color: '#f0ede8',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#94a3b8', boxShadow: '0 0 10px #94a3b8' }} />
          Audit Log
        </h1>
        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{total} entries • immutable • append-only</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportCsv} style={{
          padding: '7px 12px', borderRadius: 8,
          background: 'rgba(240,237,232,0.04)', border: '1px solid rgba(240,237,232,0.1)',
          color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'inherit', fontSize: '0.7rem',
        }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap',
        padding: '12px 14px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: 12,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(240,237,232,0.04)', border: '1px solid rgba(240,237,232,0.08)',
        }}>
          <Search size={12} color="#64748b" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actor/action/target…"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f0ede8', fontSize: '0.7rem', fontFamily: 'inherit', width: 200 }} />
        </div>

        <FilterSelect label="Actor" value={actorFilter} onChange={setActorFilter} options={['all', ...filtersMeta.actors]} />
        <FilterSelect label="Action" value={actionFilter} onChange={setActionFilter} options={['all', ...filtersMeta.actions]} />
        <FilterSelect label="Target" value={targetFilter} onChange={setTargetFilter} options={['all', ...filtersMeta.target_types]} />

        <select value={String(limit)} onChange={e => setLimit(Number(e.target.value))}
          style={{ background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)', color: '#f0ede8', padding: '6px 10px', borderRadius: 8, fontSize: '0.7rem', fontFamily: 'inherit' }}>
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
          <option value="200">200 rows</option>
          <option value="500">500 rows</option>
        </select>

        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', color: '#64748b', marginLeft: 'auto' }}>
          <Shield size={12} /> Immutable — no edit/delete from UI
        </span>
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ background: 'rgba(4,8,15,0.6)', borderBottom: '1px solid rgba(240,237,232,0.1)', textAlign: 'left' }}>
                <Th icon={Clock} label="Time" />
                <Th icon={User} label="Actor" />
                <Th icon={FileText} label="Action" />
                <Th icon={Target} label="Target" />
                <Th label="Result" />
                <Th label="IP" />
                <Th label="Details" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>Loading…</td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#475569' }}>No audit entries match filter</td></tr>
              )}
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(240,237,232,0.04)', transition: 'background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,237,232,0.03)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#94a3b8', fontSize: '0.68rem' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3,
                        background: actorTypeColor(log.actor_type) + '22', color: actorTypeColor(log.actor_type),
                        border: `1px solid ${actorTypeColor(log.actor_type)}40`, textTransform: 'uppercase', fontWeight: 700,
                      }}>{log.actor_type}</span>
                      <span style={{ color: '#cbd5e1' }}>{log.actor}</span>
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      fontSize: '0.65rem', padding: '2px 7px', borderRadius: 4,
                      background: actionColor(log.action) + '18', color: actionColor(log.action),
                      border: `1px solid ${actionColor(log.action)}30`, fontWeight: 600,
                    }}>{log.action}</span>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.65rem', textTransform: 'uppercase' }}>{log.target_type}</span>
                      <span style={{ color: '#f0ede8', fontSize: '0.7rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.target_id}>{log.target_id}</span>
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4,
                      background: log.result === 'success' ? 'rgba(52,211,153,0.15)' : log.result === 'failure' ? 'rgba(239,68,68,0.15)' : 'rgba(245,166,35,0.15)',
                      color: log.result === 'success' ? '#34d399' : log.result === 'failure' ? '#ef4444' : '#f5a623',
                      border: `1px solid ${log.result === 'success' ? 'rgba(52,211,153,0.3)' : log.result === 'failure' ? 'rgba(239,68,68,0.3)' : 'rgba(245,166,35,0.3)'}`,
                      fontWeight: 700, textTransform: 'uppercase',
                    }}>{log.result}</span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748b', fontSize: '0.65rem' }}>{log.client_ip || '—'}</td>
                  <td style={{ padding: '9px 12px', maxWidth: 220 }}>
                    {log.details ? (
                      <pre style={{
                        margin: 0, padding: '4px 6px', borderRadius: 4,
                        background: 'rgba(4,8,15,0.5)', border: '1px solid rgba(240,237,232,0.06)',
                        fontSize: '0.6rem', color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        maxHeight: 60, overflow: 'auto',
                      }}>{typeof log.details === 'string' ? log.details.slice(0, 200) : JSON.stringify(log.details, null, 2).slice(0, 300)}</pre>
                    ) : <span style={{ color: '#475569' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: '0.6rem', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
        <span>Showing {logs.length} of {total} • Sorted newest first</span>
        <span>Audit log tidak bisa dihapus/edit dari API (append-only, kecuali SQL manual)</span>
      </div>
    </div>
  )
}

function Th({ label, icon: Icon }: { label: string; icon?: any }) {
  return (
    <th style={{ padding: '10px 12px', fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {Icon && <Icon size={11} />} {label}
      </span>
    </th>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', color: '#64748b' }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)', color: '#f0ede8', padding: '5px 8px', borderRadius: 6, fontSize: '0.68rem', fontFamily: 'inherit', maxWidth: 140 }}>
        {options.map(o => <option key={o} value={o} style={{ background: '#0f172a' }}>{o}</option>)}
      </select>
    </label>
  )
}

function actorTypeColor(t: string): string {
  switch (t) {
    case 'user': return '#00e5ff'
    case 'agent': return '#a855f7'
    case 'system': return '#94a3b8'
    case 'api_key': return '#f5a623'
    default: return '#64748b'
  }
}

function actionColor(a: string): string {
  if (a.includes('task.')) return '#00e5ff'
  if (a.includes('approval.')) return '#f5a623'
  if (a.includes('agent.')) return '#a855f7'
  if (a.includes('dispatch')) return '#34d399'
  if (a.includes('settings')) return '#94a3b8'
  if (a.includes('auth')) return '#ef4444'
  return '#94a3b8'
}

'use client'

/**
 * AgentDetail — slide-over / full page detail untuk satu agent
 * Tabs: Overview, Tasks, Config, Logs
 */

import { useEffect, useState } from 'react'
import { X, Bot, Activity, DollarSign, Clock, CheckCircle2, XCircle, Cpu, Settings, FileText, Terminal, Save, Power, RotateCcw } from 'lucide-react'
import { toast } from '../ui/Toast'

interface AgentDetailData {
  agent: any
  stats: any
  cost: any
  recent_tasks: any[]
  activity_7d: any[]
  logs: any[]
}

interface Props {
  agentId: string | null
  onClose: () => void
  onUpdated?: () => void
}

type Tab = 'overview' | 'tasks' | 'config' | 'logs'

export default function AgentDetail({ agentId, onClose, onUpdated }: Props) {
  const [data, setData] = useState<AgentDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [editModel, setEditModel] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [editColor, setEditColor] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!agentId) return
    setLoading(true)
    fetch(`/api/mc/agents/${agentId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setEditModel(d.agent?.model_default || '')
        setEditPrompt(d.agent?.system_prompt || '')
        setEditColor(d.agent?.color || '#00e5ff')
      })
      .catch(() => toast.error('Failed to load agent'))
      .finally(() => setLoading(false))
  }, [agentId])

  useEffect(() => {
    if (!agentId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [agentId])

  useEffect(() => {
    if (!agentId) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [agentId, onClose])

  if (!agentId) return null

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/mc/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_default: editModel, system_prompt: editPrompt, color: editColor }),
      })
      if (res.ok) {
        toast.success('Agent config saved')
        onUpdated?.()
        // reload
        const d = await fetch(`/api/mc/agents/${agentId}`).then(r => r.json())
        setData(d)
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error || 'Failed to save')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async () => {
    if (!data) return
    const newEnabled = data.agent.enabled ? 0 : 1
    try {
      const res = await fetch(`/api/mc/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      })
      if (res.ok) {
        toast.success(newEnabled ? 'Agent enabled' : 'Agent disabled')
        const d = await fetch(`/api/mc/agents/${agentId}`).then(r => r.json())
        setData(d)
        onUpdated?.()
      }
    } catch {
      toast.error('Failed to toggle')
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(4,8,15,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'flex-end',
      animation: 'ad-fade 0.2s ease-out',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(720px, 96vw)', height: '100%',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(4,8,15,0.99))',
        borderLeft: '1px solid rgba(168,85,247,0.25)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        animation: 'ad-slide 0.25s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(240,237,232,0.08)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: data ? `radial-gradient(circle at 35% 35%, ${data.agent.color}ff, ${data.agent.color}66, rgba(4,8,15,0.9))` : '#1e293b',
            border: `2px solid ${data?.agent.color || '#64748b'}80`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Bot size={22} color="#f0ede8" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f0ede8' }}>{data?.agent.name || agentId}</h2>
              {data && (
                <span style={{
                  fontSize: '0.6rem', padding: '2px 7px', borderRadius: 4,
                  background: statusColor(data.agent.status) + '22', color: statusColor(data.agent.status),
                  border: `1px solid ${statusColor(data.agent.status)}40`, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{data.agent.status}</span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{data?.agent.role || ''}</div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 4, display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Cpu size={11} /> {data?.agent.model_default || '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Activity size={11} /> {data?.agent.adapter || '—'} adapter</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 22px', borderBottom: '1px solid rgba(240,237,232,0.06)', background: 'rgba(4,8,15,0.4)' }}>
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'tasks', label: 'Tasks', icon: FileText },
            { id: 'config', label: 'Config', icon: Settings },
            { id: 'logs', label: 'Logs', icon: Terminal },
          ].map(t => {
            const I = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id as Tab)}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: active ? 'rgba(168,85,247,0.15)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(168,85,247,0.4)' : 'transparent'}`,
                  color: active ? '#a855f7' : '#94a3b8',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <I size={13} /> {t.label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {loading && <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Loading…</div>}
          {!loading && data && (
            <>
              {tab === 'overview' && <OverviewTab data={data} />}
              {tab === 'tasks' && <TasksTab tasks={data.recent_tasks} />}
              {tab === 'config' && (
                <ConfigTab
                  model={editModel} setModel={setEditModel}
                  prompt={editPrompt} setPrompt={setEditPrompt}
                  color={editColor} setColor={setEditColor}
                  saving={saving} onSave={saveConfig}
                  enabled={!!data.agent.enabled} onToggle={toggleEnabled}
                  agent={data.agent}
                />
              )}
              {tab === 'logs' && <LogsTab logs={data.logs} />}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ad-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ad-slide { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </div>
  )
}

function OverviewTab({ data }: { data: AgentDetailData }) {
  const s = data.stats
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <BigStat label="Total Tasks" value={String(s.total_tasks ?? 0)} color="#94a3b8" />
        <BigStat label="Success Rate" value={`${s.success_rate ?? 0}%`} color={(s.success_rate ?? 0) >= 80 ? '#34d399' : '#f5a623'} />
        <BigStat label="Avg Duration" value={s.avg_duration ? `${s.avg_duration}s` : '—'} color="#00e5ff" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <BigStat label="Total Cost" value={`$${(data.cost.total_cost ?? 0).toFixed(4)}`} color="#f5a623" />
        <BigStat label="Tokens" value={`${((data.cost.input_tokens ?? 0) + (data.cost.output_tokens ?? 0)).toLocaleString()}`} color="#a855f7" />
      </div>

      {/* Cost by model */}
      {data.cost.by_model?.length > 0 && (
        <Section title="Cost by Model">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.cost.by_model.map((m: any) => (
              <div key={m.model} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(240,237,232,0.03)', borderRadius: 8, border: '1px solid rgba(240,237,232,0.06)' }}>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1', flex: 1 }}>{m.model}</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{m.cnt} runs</span>
                <span style={{ fontSize: '0.75rem', color: '#f5a623', fontWeight: 700 }}>${Number(m.cost).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 7d activity */}
      <Section title="7-Day Activity">
        {data.activity_7d.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>No activity last 7 days</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {data.activity_7d.map((d: any) => {
              const max = Math.max(1, ...data.activity_7d.map((x: any) => x.cnt))
              return (
                <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: `${(d.cnt / max) * 100}%`, minHeight: 4, background: 'linear-gradient(180deg, #a855f7, #00e5ff)', borderRadius: 4 }} />
                  <span style={{ fontSize: '0.55rem', color: '#64748b' }}>{d.day.slice(5)}</span>
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>{d.cnt}</span>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

function TasksTab({ tasks }: { tasks: any[] }) {
  if (tasks.length === 0) return <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No tasks yet</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map((t: any) => (
        <div key={t.id} style={{ padding: '10px 12px', background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.07)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4,
            background: statusColor(t.status) + '22', color: statusColor(t.status), border: `1px solid ${statusColor(t.status)}40`,
            fontWeight: 700, textTransform: 'uppercase',
          }}>{t.status}</span>
          <span style={{ fontSize: '0.78rem', color: '#f0ede8', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{new Date(t.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function ConfigTab({ model, setModel, prompt, setPrompt, color, setColor, saving, onSave, enabled, onToggle, agent }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: enabled ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${enabled ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 10 }}>
        <Power size={16} color={enabled ? '#34d399' : '#ef4444'} />
        <span style={{ flex: 1, fontSize: '0.8rem', color: enabled ? '#34d399' : '#ef4444', fontWeight: 600 }}>{enabled ? 'Agent Enabled' : 'Agent Disabled'}</span>
        <button onClick={onToggle} style={{
          padding: '6px 12px', borderRadius: 6, border: 'none',
          background: enabled ? '#ef4444' : '#34d399', color: '#04080f',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700,
        }}>{enabled ? 'Disable' : 'Enable'}</button>
      </div>

      <Field label="Model Default">
        <input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. claude-opus, opencode-zen"
          style={inputStyle} />
      </Field>

      <Field label="Color">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid rgba(240,237,232,0.15)', background: 'transparent', cursor: 'pointer' }} />
          <input value={color} onChange={e => setColor(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <div style={{ width: 36, height: 36, borderRadius: 8, background: color, border: '1px solid rgba(240,237,232,0.15)' }} />
        </div>
      </Field>

      <Field label="System Prompt">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={8}
          placeholder="System prompt override untuk agent ini…"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </Field>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onSave} disabled={saving}
          style={{
            padding: '10px 18px', background: 'linear-gradient(90deg, #a855f7, #00e5ff)', border: 'none', borderRadius: 8,
            color: '#04080f', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <Save size={14} /> {saving ? 'Saving…' : 'Save Config'}
        </button>
        <div style={{ fontSize: '0.68rem', color: '#64748b', display: 'flex', alignItems: 'center' }}>
          ID: {agent.id} • Adapter: {agent.adapter} • Created: {new Date(agent.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  )
}

function LogsTab({ logs }: { logs: any[] }) {
  if (logs.length === 0) return <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No logs for this agent</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {logs.map((l: any) => (
        <div key={l.id} style={{
          padding: '8px 10px', borderRadius: 8,
          background: l.level === 'error' ? 'rgba(239,68,68,0.08)' : l.level === 'warn' ? 'rgba(245,166,35,0.08)' : 'rgba(240,237,232,0.03)',
          border: `1px solid ${l.level === 'error' ? 'rgba(239,68,68,0.2)' : l.level === 'warn' ? 'rgba(245,166,35,0.2)' : 'rgba(240,237,232,0.06)'}`,
          fontSize: '0.7rem', color: l.level === 'error' ? '#fca5a5' : l.level === 'warn' ? '#fde68a' : '#cbd5e1',
          display: 'flex', gap: 8,
        }}>
          <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleTimeString()}</span>
          <span style={{ color: levelColor(l.level), fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>{l.level}</span>
          <span style={{ flex: 1 }}>{l.message}</span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function BigStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '12px', background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.07)', borderRadius: 10, textAlign: 'center' }}>
      <div style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.62rem', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)',
  borderRadius: 8, padding: '10px 12px', color: '#f0ede8', fontSize: '0.8rem',
  fontFamily: 'inherit', outline: 'none',
}

function statusColor(s: string): string {
  switch (s) {
    case 'online': case 'idle': return '#94a3b8'
    case 'working': case 'running': return '#00e5ff'
    case 'done': return '#34d399'
    case 'failed': case 'error': return '#ef4444'
    case 'queued': case 'inbox': return '#f5a623'
    case 'review': return '#a855f7'
    default: return '#64748b'
  }
}

function levelColor(l: string): string {
  switch (l) {
    case 'error': return '#ef4444'
    case 'warn': return '#f5a623'
    case 'info': return '#00e5ff'
    default: return '#64748b'
  }
}

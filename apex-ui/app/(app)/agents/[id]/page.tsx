'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Bot, Activity, DollarSign, FileText, Settings, Terminal, Save, Power } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

type Tab = 'overview' | 'tasks' | 'config' | 'logs'

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [editModel, setEditModel] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [editColor, setEditColor] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/mc/agents/${agentId}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed')
      setData(d)
      setEditModel(d.agent?.model_default || '')
      setEditPrompt(d.agent?.system_prompt || '')
      setEditColor(d.agent?.color || '#00e5ff')
    } catch (e: any) {
      toast.error(e.message || 'Failed to load agent')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [agentId])

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/mc/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_default: editModel, system_prompt: editPrompt, color: editColor }),
      })
      if (res.ok) {
        toast.success('Config saved')
        load()
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error || 'Failed')
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
        toast.success(newEnabled ? 'Enabled' : 'Disabled')
        load()
      }
    } catch {
      toast.error('Failed')
    }
  }

  if (loading) {
    return <div style={{ padding: 40, color: '#64748b', fontFamily: 'monospace' }}>Loading agent {agentId}…</div>
  }
  if (!data) {
    return <div style={{ padding: 40, color: '#ef4444', fontFamily: 'monospace' }}>Agent not found</div>
  }

  const agent = data.agent
  const s = data.stats

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: '#04080f', color: '#f0ede8', fontFamily: '"JetBrains Mono", monospace', padding: '20px 24px' }}>
      <button onClick={() => router.push('/agents')} style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        background: 'rgba(240,237,232,0.04)', border: '1px solid rgba(240,237,232,0.1)', borderRadius: 8,
        padding: '7px 12px', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem',
      }}>
        <ArrowLeft size={14} /> Back to Agents
      </button>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-start' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${agent.color}ff, ${agent.color}66, rgba(4,8,15,0.9))`,
          border: `2px solid ${agent.color}80`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={28} color="#f0ede8" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{agent.name}</h1>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>{agent.role} • {agent.id} • {agent.status}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6 }}>Model: {agent.model_default || '—'} • Adapter: {agent.adapter} • {agent.enabled ? 'Enabled' : 'Disabled'}</div>
        </div>
        <button onClick={toggleEnabled} style={{
          padding: '8px 14px', borderRadius: 8, border: 'none',
          background: agent.enabled ? '#ef4444' : '#34d399', color: '#04080f',
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.75rem',
        }}>
          <Power size={14} style={{ display: 'inline', marginRight: 6 }} />{agent.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid rgba(240,237,232,0.08)', paddingBottom: 12 }}>
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'tasks', label: 'Tasks', icon: FileText },
          { id: 'config', label: 'Config', icon: Settings },
          { id: 'logs', label: 'Logs', icon: Terminal },
        ].map(t => {
          const I = t.icon as any
          return (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: tab === t.id ? 'rgba(168,85,247,0.15)' : 'transparent',
                border: `1px solid ${tab === t.id ? 'rgba(168,85,247,0.4)' : 'transparent'}`,
                color: tab === t.id ? '#a855f7' : '#94a3b8',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <I size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatBox label="Total" value={String(s.total_tasks ?? 0)} />
          <StatBox label="Success Rate" value={`${s.success_rate ?? 0}%`} color={s.success_rate >= 80 ? '#34d399' : '#f5a623'} />
          <StatBox label="Avg Duration" value={s.avg_duration ? `${s.avg_duration}s` : '—'} color="#00e5ff" />
          <StatBox label="Total Cost" value={`$${(data.cost.total_cost ?? 0).toFixed(4)}`} color="#f5a623" />
        </div>
      )}

      {tab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.recent_tasks.map((t: any) => (
            <div key={t.id} style={{ padding: '10px 12px', background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.07)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4, background: '#94a3b822', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{t.status}</span>
              <span style={{ flex: 1, fontSize: '0.8rem' }}>{t.title}</span>
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{new Date(t.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'config' && (
        <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Model Default</span>
            <input value={editModel} onChange={e => setEditModel(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Color</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid rgba(240,237,232,0.15)', background: 'transparent' }} />
              <input value={editColor} onChange={e => setEditColor(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>System Prompt</span>
            <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} rows={10} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          <button onClick={saveConfig} disabled={saving} style={{
            padding: '10px 18px', background: 'linear-gradient(90deg, #a855f7, #00e5ff)', border: 'none', borderRadius: 8,
            color: '#04080f', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.75rem',
            display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content',
          }}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      )}

      {tab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.logs.map((l: any) => (
            <div key={l.id} style={{
              padding: '8px 10px', borderRadius: 8,
              background: l.level === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(240,237,232,0.03)',
              border: '1px solid rgba(240,237,232,0.06)', fontSize: '0.7rem', display: 'flex', gap: 8,
            }}>
              <span style={{ color: '#64748b' }}>{new Date(l.created_at).toLocaleTimeString()}</span>
              <span style={{ color: l.level === 'error' ? '#ef4444' : '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{l.level}</span>
              <span style={{ flex: 1 }}>{l.message}</span>
            </div>
          ))}
          {data.logs.length === 0 && <div style={{ color: '#64748b' }}>No logs</div>}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: 14, background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.07)', borderRadius: 12, textAlign: 'center' }}>
      <div style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: color || '#f0ede8' }}>{value}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)',
  borderRadius: 8, padding: '10px 12px', color: '#f0ede8', fontSize: '0.8rem',
  fontFamily: 'inherit', outline: 'none',
}

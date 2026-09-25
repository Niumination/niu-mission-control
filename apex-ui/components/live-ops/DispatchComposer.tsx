'use client'

/**
 * DispatchComposer — form cepat kirim tugas baru di Live Ops
 * Mirip CreateTaskModal tapi inline
 */

import { useState, useEffect } from 'react'
import { Send, Bot, AlertTriangle } from 'lucide-react'
import { useAgentsStore } from '@/lib/client/stores'
import { toast } from '../ui/Toast'

export default function DispatchComposer() {
  const agents = useAgentsStore(s => Object.values(s.agents))
  const [title, setTitle] = useState('')
  const [instruction, setInstruction] = useState('')
  const [agentId, setAgentId] = useState('chief')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (agents.length > 0 && !agents.find(a => a.id === agentId)) {
      setAgentId(agents[0].id)
    }
  }, [agents, agentId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/mc/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          instruction: instruction.trim() || title.trim(),
          agent: agentId,
          priority,
          metadata: requiresApproval ? { requires_approval: true } : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        toast.success(`Dispatched: ${title.slice(0, 40)}`)
        setTitle('')
        setInstruction('')
      } else {
        toast.error(data.error || 'Failed to dispatch')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} style={{
      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: 12,
      padding: 14, fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Send size={14} color="#00e5ff" />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00e5ff' }}>Dispatch Composer</span>
        <span style={{ fontSize: '0.6rem', color: '#64748b' }}>• Send task to swarm</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title — e.g. Audit auth middleware"
          style={inputStyle}
        />
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="Detailed instruction (optional, defaults to title)"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}><Bot size={10} /> Agent</span>
            <select value={agentId} onChange={e => setAgentId(e.target.value)} style={inputStyle}>
              {agents.map(a => (
                <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name} ({a.id})</option>
              ))}
              {agents.length === 0 && <option value="chief">Chief</option>}
            </select>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={labelStyle}>Priority</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['high', 'medium', 'low'] as const).map(p => {
                const active = priority === p
                const color = p === 'high' ? '#ef4444' : p === 'medium' ? '#f5a623' : '#34d399'
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6,
                      background: active ? `${color}22` : 'rgba(240,237,232,0.04)',
                      border: `1px solid ${active ? `${color}80` : 'rgba(240,237,232,0.1)'}`,
                      color: active ? color : '#94a3b8', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    }}>{p[0]}</button>
                )
              })}
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.7rem', color: '#94a3b8' }}>
          <input type="checkbox" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)} style={{ accentColor: '#f5a623' }} />
          <AlertTriangle size={12} color={requiresApproval ? '#f5a623' : '#64748b'} />
          Requires approval gate
        </label>

        <button type="submit" disabled={!title.trim() || busy}
          style={{
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: title.trim() && !busy ? 'linear-gradient(90deg, #00e5ff, #f5a623)' : 'rgba(240,237,232,0.08)',
            color: title.trim() && !busy ? '#04080f' : '#64748b',
            cursor: title.trim() && !busy ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <Send size={13} /> {busy ? 'Dispatching…' : 'Dispatch Task'}
        </button>
      </div>
    </form>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase',
  display: 'flex', alignItems: 'center', gap: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)',
  borderRadius: 8, padding: '8px 10px', color: '#f0ede8', fontSize: '0.75rem',
  fontFamily: 'inherit', outline: 'none',
}

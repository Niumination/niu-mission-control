'use client'

/**
 * CreateTaskModal — modal form untuk membuat task baru.
 * Field: title (wajib), description/instruction, agent, priority.
 * Submit → POST /api/mc/dispatch → close + toast.
 */

import { useEffect, useState } from 'react'
import { X, PlusCircle, Send } from 'lucide-react'
import { useAgentsStore } from '@/lib/client/stores'
import { toast } from '../ui/Toast'

interface Props { open: boolean; onClose: () => void }

export default function CreateTaskModal({ open, onClose }: Props) {
  const agents = useAgentsStore(s => Object.values(s.agents).filter(a => a.status !== 'offline'))
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [agentId, setAgentId] = useState('chief')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(''); setDescription(''); setAgentId('chief'); setPriority('medium'); setBusy(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/mc/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          instruction: description.trim() || title.trim(),
          agent: agentId,
          priority,
        }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        toast.success(`Task dispatched: ${title.slice(0, 40)}`)
        onClose()
      } else {
        toast.error(data.error || 'Failed to dispatch')
      }
    } catch {
      toast.error('Network error dispatching task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(4,8,15,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      animation: 'ctm-fade 0.15s ease-out',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} style={{
        width: 'min(520px, 100%)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(4,8,15,0.99))',
        border: '1px solid rgba(0,229,255,0.25)',
        borderRadius: 14, padding: 24,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,229,255,0.08)',
        animation: 'ctm-pop 0.2s cubic-bezier(.2,.9,.3,1.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,229,255,0.3)',
          }}>
            <PlusCircle size={20} color="#00e5ff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f0ede8' }}>New Task</h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>Kirim instruksi ke swarm; chief akan mendelegasikan jika diperlukan.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Title" required>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Refactor auth middleware, draft weekly report…"
              style={inputStyle}
            />
          </Field>

          <Field label="Instruction">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detail instruksi (opsional; default = title)"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Assign to">
              <select value={agentId} onChange={e => setAgentId(e.target.value)} style={inputStyle}>
                {agents.length === 0 && <option value="chief">Chief (default)</option>}
                {agents.map(a => (
                  <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>
                    {a.name} {a.id === 'chief' ? '(orchestrator)' : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['high', 'medium', 'low'] as const).map(p => {
                  const active = priority === p
                  const color = p === 'high' ? '#ef4444' : p === 'medium' ? '#f5a623' : '#34d399'
                  return (
                    <button type="button" key={p} onClick={() => setPriority(p)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 6,
                        background: active ? color + '22' : 'rgba(240,237,232,0.04)',
                        border: `1px solid ${active ? color + '80' : 'rgba(240,237,232,0.12)'}`,
                        color: active ? color : '#94a3b8',
                        cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        transition: 'all 0.15s',
                      }}>{p}</button>
                  )
                })}
              </div>
            </Field>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{
              padding: '9px 16px', background: 'transparent',
              border: '1px solid rgba(240,237,232,0.15)', borderRadius: 8,
              color: '#94a3b8', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Cancel</button>
          <button type="submit" disabled={!title.trim() || busy}
            style={{
              padding: '9px 18px',
              background: title.trim() && !busy ? 'linear-gradient(90deg, #00e5ff, #f5a623)' : 'rgba(240,237,232,0.08)',
              border: 'none', borderRadius: 8,
              color: title.trim() && !busy ? '#04080f' : '#64748b',
              cursor: title.trim() && !busy ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: title.trim() && !busy ? '0 4px 16px rgba(0,229,255,0.25)' : 'none',
            }}>
            <Send size={13} /> {busy ? 'Dispatching…' : 'Dispatch'}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes ctm-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ctm-pop  { from { opacity: 0; transform: scale(0.95) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: '0.62rem', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)',
  borderRadius: 8, padding: '9px 12px', color: '#f0ede8', fontSize: '0.8rem',
  fontFamily: 'inherit', outline: 'none',
}

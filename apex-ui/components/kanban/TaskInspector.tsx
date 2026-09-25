'use client'

/**
 * TaskInspector — slide-over panel kanan untuk melihat detail task + aksi:
 *  - Start / Complete / Approve / Reject / Fail / Cancel / Retry
 *  - Metadata lengkap (id, agent, priority, timestamps, retries)
 *  - Result / error message
 *  - Artifacts list
 */

import { useEffect, useState } from 'react'
import { X, Play, CheckCircle2, XCircle, RotateCcw, ThumbsUp, ThumbsDown, Clock, Bot, AlertTriangle, Coins, FileText, Activity } from 'lucide-react'
import { useTasksStore, useAgentsStore, type TaskState } from '@/lib/client/stores'
import { toast } from '../ui/Toast'

interface Props { taskId: string | null; onClose: () => void }

// Transisi valid yang tersedia sebagai aksi tombol (dari state-machine VALID_TRANSITIONS)
const ACTIONS: Record<string, Array<{ to: string; label: string; icon: React.ComponentType<{ size?: number }>; color: string; variant?: 'approve' | 'reject' }>> = {
  inbox:   [{ to: 'queued',    label: 'Queue',   icon: Play,        color: '#f5a623' }, { to: 'cancelled', label: 'Cancel', icon: XCircle, color: '#64748b' }],
  queued:  [{ to: 'running',   label: 'Start',   icon: Play,        color: '#00e5ff' }, { to: 'cancelled', label: 'Cancel', icon: XCircle, color: '#64748b' }],
  running: [{ to: 'review',    label: 'Submit',  icon: CheckCircle2, color: '#a855f7' }, { to: 'failed', label: 'Fail',  icon: XCircle, color: '#ef4444' }, { to: 'cancelled', label: 'Cancel', icon: XCircle, color: '#64748b' }],
  review:  [
    { to: 'done',    label: 'Approve', icon: ThumbsUp, color: '#34d399', variant: 'approve' },
    { to: 'queued',  label: 'Rework',  icon: RotateCcw, color: '#f5a623' },
    { to: 'failed',  label: 'Reject',  icon: ThumbsDown, color: '#ef4444', variant: 'reject' },
    { to: 'cancelled', label: 'Cancel', icon: XCircle, color: '#64748b' },
  ],
  failed:  [{ to: 'queued', label: 'Retry', icon: RotateCcw, color: '#00e5ff' }, { to: 'cancelled', label: 'Cancel', icon: XCircle, color: '#64748b' }],
  done:    [],
  cancelled: [],
}

export default function TaskInspector({ taskId, onClose }: Props) {
  const task: TaskState | undefined = useTasksStore(s => taskId ? s.tasks[taskId] : undefined)
  const agent = useAgentsStore(s => task?.assigned_agent ? s.agents[task.assigned_agent] : undefined)
  const [busy, setBusy] = useState<string | null>(null)

  // Lock scroll saat terbuka
  useEffect(() => {
    if (!taskId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [taskId])

  // ESC tutup
  useEffect(() => {
    if (!taskId) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [taskId, onClose])

  if (!taskId) return null

  const transition = async (newStatus: string, label: string) => {
    setBusy(newStatus)
    try {
      const res = await fetch(`/api/mc/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Task ${label.toLowerCase()}`)
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || `Failed to ${label.toLowerCase()}`)
      }
    } catch {
      toast.error(`Network error when ${label.toLowerCase()}`)
    } finally {
      setBusy(null)
    }
  }

  const actions = task ? ACTIONS[task.status] || [] : []

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(4,8,15,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'flex-end',
      animation: 'insp-fade 0.2s ease-out',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(480px, 92vw)', height: '100%',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(4,8,15,0.99))',
        borderLeft: '1px solid rgba(0,229,255,0.2)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        animation: 'insp-slide 0.25s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid rgba(240,237,232,0.08)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: '0.6rem', padding: '2px 7px', borderRadius: 4,
                background: 'rgba(240,237,232,0.06)', color: '#94a3b8',
                border: '1px solid rgba(240,237,232,0.1)',
                letterSpacing: '0.1em', fontWeight: 600,
              }}>{taskId}</span>
              {task && (
                <span style={{
                  fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4,
                  letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase',
                  background: statusColor(task.status) + '22',
                  color: statusColor(task.status),
                  border: `1px solid ${statusColor(task.status)}40`,
                }}>{task.status}</span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f0ede8', lineHeight: 1.3 }}>
              {task?.title || 'Task not found'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#94a3b8', padding: 6, borderRadius: 6,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f0ede8'; e.currentTarget.style.background = 'rgba(240,237,232,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent' }}
          ><X size={18} /></button>
        </div>

        {/* Body */}
        {task && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
            {/* Description / instruction */}
            {(task.description || (task as any).instruction) && (
              <Section title="Instruction">
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {task.description || (task as any).instruction}
                </div>
              </Section>
            )}

            {/* Metadata grid */}
            <Section title="Metadata">
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: '0.72rem' }}>
                <MetaRow label="Agent" icon={Bot} value={task.agent_name || task.assigned_agent || '—'} valueColor="#00e5ff" />
                <MetaRow label="Priority" icon={AlertTriangle} value={task.priority.toUpperCase()} valueColor={priorityColor(task.priority)} />
                <MetaRow label="Created" icon={Clock} value={fmtTime(task.created_at)} />
                {task.started_at && <MetaRow label="Started" icon={Activity} value={fmtTime(task.started_at)} />}
                {task.completed_at && <MetaRow label="Completed" icon={CheckCircle2} value={fmtTime(task.completed_at)} valueColor="#34d399" />}
                {task.failed_at && <MetaRow label="Failed" icon={XCircle} value={fmtTime(task.failed_at)} valueColor="#ef4444" />}
                <MetaRow label="Retries" icon={RotateCcw} value={String(task.retry_count ?? 0)} />
                {task.cost_estimate_usd != null && (
                  <MetaRow label="Cost" icon={Coins} value={`$${task.cost_estimate_usd.toFixed(4)}`} valueColor="#f5a623" />
                )}
                {task.artifact_count != null && task.artifact_count > 0 && (
                  <MetaRow label="Artifacts" icon={FileText} value={String(task.artifact_count)} />
                )}
              </div>
            </Section>

            {/* Result */}
            {task.result && (
              <Section title="Result">
                <pre style={{
                  margin: 0, padding: 10, borderRadius: 8,
                  background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)',
                  color: '#a7f3d0', fontSize: '0.7rem', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto',
                }}>{task.result.slice(0, 4000)}</pre>
              </Section>
            )}

            {/* Error */}
            {task.error_message && (
              <Section title="Error">
                <pre style={{
                  margin: 0, padding: 10, borderRadius: 8,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5', fontSize: '0.7rem', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto',
                }}>{task.error_message}</pre>
              </Section>
            )}
          </div>
        )}

        {/* Actions */}
        {task && actions.length > 0 && (
          <div style={{
            padding: '14px 22px', borderTop: '1px solid rgba(240,237,232,0.08)',
            display: 'flex', gap: 8, flexWrap: 'wrap',
          }}>
            {actions.map(a => {
              const I = a.icon
              const isApprove = a.variant === 'approve'
              const isReject = a.variant === 'reject'
              return (
                <button
                  key={a.to}
                  disabled={busy !== null}
                  onClick={() => transition(a.to, a.label)}
                  style={{
                    flex: isApprove || isReject ? 1 : undefined,
                    padding: '9px 14px',
                    background: isApprove
                      ? 'linear-gradient(90deg, rgba(52,211,153,0.9), rgba(52,211,153,0.7))'
                      : isReject
                      ? 'linear-gradient(90deg, rgba(239,68,68,0.8), rgba(239,68,68,0.6))'
                      : `${a.color}22`,
                    border: `1px solid ${a.color}${isApprove || isReject ? 'aa' : '50'}`,
                    borderRadius: 8,
                    color: isApprove || isReject ? '#04080f' : a.color,
                    cursor: busy ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 6,
                    opacity: busy && busy !== a.to ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!busy && !isApprove && !isReject) { e.currentTarget.style.background = `${a.color}40` } }}
                  onMouseLeave={e => { if (!busy && !isApprove && !isReject) { e.currentTarget.style.background = `${a.color}22` } }}
                >
                  <I size={13} /> {busy === a.to ? 'Working…' : a.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes insp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes insp-slide { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.18em', textTransform: 'uppercase',
        marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  )
}

function MetaRow({ label, icon: Icon, value, valueColor }: { label: string; icon: React.ComponentType<{ size?: number; color?: string }>; value: string; valueColor?: string }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b' }}>
        <Icon size={11} /> {label}
      </div>
      <div style={{ color: valueColor || '#cbd5e1' }}>{value}</div>
    </>
  )
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function statusColor(s: string): string {
  switch (s) {
    case 'running': return '#00e5ff'
    case 'queued': case 'inbox': return '#f5a623'
    case 'review': return '#a855f7'
    case 'done': return '#34d399'
    case 'failed': return '#ef4444'
    default: return '#64748b'
  }
}

function priorityColor(p: string): string {
  return p === 'high' ? '#ef4444' : p === 'low' ? '#34d399' : '#f5a623'
}

'use client'

/**
 * ApprovalQueue — list approvals pending dengan Approve/Reject cepat
 * Fetch dari /api/mc/approvals?status=pending + real-time via SSE
 */

import { useEffect, useState } from 'react'
import { Shield, Check, X, Clock, AlertTriangle } from 'lucide-react'
import { useActivityStore } from '@/lib/client/stores'
import { toast } from '../ui/Toast'

interface Approval {
  id: string
  task_id: string
  task_title?: string
  action_type: string
  payload: any
  requested_by: string
  agent_name?: string
  status: string
  created_at: string
  expires_at?: string | null
}

export default function ApprovalQueue() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const activityEvents = useActivityStore(s => s.events)

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/mc/approvals?status=pending&limit=20')
      const data = await res.json()
      if (data.approvals) setApprovals(data.approvals)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApprovals()
    const id = setInterval(fetchApprovals, 5000)
    return () => clearInterval(id)
  }, [])

  // Listen to approval events via SSE
  useEffect(() => {
    const last = activityEvents[activityEvents.length - 1]
    if (!last) return
    if (last.type.startsWith('approval.')) {
      fetchApprovals()
    }
  }, [activityEvents])

  const decide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setBusyId(approvalId)
    try {
      const res = await fetch(`/api/mc/approvals/${approvalId}/${decision}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: decision === 'rejected' ? 'Rejected from Live Ops' : undefined }),
      })
      if (res.ok) {
        toast.success(`Approval ${decision}`)
        fetchApprovals()
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error || `Failed to ${decision}`)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 12,
      overflow: 'hidden', fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid rgba(245,166,35,0.2)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(245,166,35,0.08)',
      }}>
        <Shield size={14} color="#f5a623" />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f5a623' }}>
          Approval Queue
        </span>
        <span style={{
          marginLeft: 8, fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10,
          background: approvals.length > 0 ? 'rgba(245,166,35,0.2)' : 'rgba(240,237,232,0.06)',
          color: approvals.length > 0 ? '#f5a623' : '#64748b', fontWeight: 700,
        }}>{approvals.length} pending</span>
        {approvals.length > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f5a623', boxShadow: '0 0 8px #f5a623', marginLeft: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />}
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {loading && <div style={{ padding: 16, color: '#64748b', fontSize: '0.7rem' }}>Loading approvals…</div>}
        {!loading && approvals.length === 0 && (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: '#475569', fontSize: '0.7rem' }}>
            <Shield size={20} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
            No pending approvals — all clear
          </div>
        )}
        {approvals.map(a => (
          <div key={a.id} style={{
            padding: '10px 14px', borderBottom: '1px solid rgba(240,237,232,0.06)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: '0.58rem', padding: '2px 6px', borderRadius: 4,
                background: actionColor(a.action_type) + '22', color: actionColor(a.action_type),
                border: `1px solid ${actionColor(a.action_type)}40`, fontWeight: 700, textTransform: 'uppercase',
              }}>{a.action_type}</span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{a.agent_name || a.requested_by}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: '0.6rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} /> {timeAgo(a.created_at)}
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#f0ede8', lineHeight: 1.3 }}>
              {a.task_title || a.task_id}
            </div>

            {a.payload && (
              <pre style={{
                margin: 0, padding: '6px 8px', borderRadius: 6,
                background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.08)',
                fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 80, overflow: 'auto',
              }}>{typeof a.payload === 'string' ? a.payload : JSON.stringify(a.payload, null, 2).slice(0, 400)}</pre>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={!!busyId} onClick={() => decide(a.id, 'approved')}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6, border: 'none',
                  background: 'linear-gradient(90deg, #34d399, #00e5ff)', color: '#04080f',
                  cursor: busyId ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '0.68rem', fontWeight: 700,
                  textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  opacity: busyId && busyId !== a.id ? 0.5 : 1,
                }}>
                <Check size={12} /> {busyId === a.id ? '…' : 'Approve'}
              </button>
              <button disabled={!!busyId} onClick={() => decide(a.id, 'rejected')}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6,
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', cursor: busyId ? 'wait' : 'pointer',
                  fontFamily: 'inherit', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  opacity: busyId && busyId !== a.id ? 0.5 : 1,
                }}>
                <X size={12} /> Reject
              </button>
            </div>

            {a.expires_at && (
              <div style={{ fontSize: '0.6rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={10} /> Expires {new Date(a.expires_at).toLocaleTimeString()} • {timeAgo(a.expires_at)} left
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </div>
  )
}

function actionColor(type: string): string {
  switch (type) {
    case 'shell_exec': return '#a855f7'
    case 'deploy': return '#ef4444'
    case 'file_delete': return '#f5a623'
    case 'external_send': return '#00e5ff'
    case 'db_mutation': return '#f5a623'
    default: return '#94a3b8'
  }
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

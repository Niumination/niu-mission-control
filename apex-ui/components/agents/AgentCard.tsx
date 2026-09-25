'use client'

/**
 * AgentCard — kartu agent di grid /agents
 * Menampilkan: avatar orb mini, nama, role, status dot, model, stats, sparkline, current task
 */

import { Bot, Cpu, DollarSign, Activity, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export interface AgentCardData {
  id: string
  name: string
  role: string
  color: string
  status: string
  model_default?: string | null
  description?: string | null
  total_tasks?: number
  completed_tasks?: number
  failed_tasks?: number
  running_tasks?: number
  pending_tasks?: number
  total_cost_usd?: number
  success_rate?: number
  avg_duration_sec?: number | null
  current_task_id?: string | null
  current_task_title?: string | null
  sparkline_24h?: number[]
  enabled?: number
  last_seen?: string | null
}

interface Props {
  agent: AgentCardData
  onClick: () => void
  isChief?: boolean
}

const STATUS_META: Record<string, { label: string; color: string; pulse: boolean }> = {
  online:  { label: 'ONLINE',  color: '#34d399', pulse: false },
  idle:    { label: 'IDLE',    color: '#94a3b8', pulse: false },
  working: { label: 'WORKING', color: '#00e5ff', pulse: true },
  offline: { label: 'OFFLINE', color: '#64748b', pulse: false },
  error:   { label: 'ERROR',   color: '#ef4444', pulse: true },
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AgentCard({ agent, onClick, isChief }: Props) {
  const meta = STATUS_META[agent.status] || STATUS_META.offline
  const sparkline = agent.sparkline_24h || []
  const maxSpark = Math.max(1, ...sparkline)

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: isChief
          ? 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(15,23,42,0.9))'
          : 'rgba(15,23,42,0.7)',
        border: `1px solid ${isChief ? 'rgba(0,229,255,0.3)' : 'rgba(240,237,232,0.08)'}`,
        borderRadius: 14,
        padding: isChief ? '20px 22px' : '16px 18px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        boxShadow: isChief ? '0 0 30px rgba(0,229,255,0.15)' : 'none',
        fontFamily: '"JetBrains Mono", monospace',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = agent.color + '80'
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 30px rgba(0,0,0,0.4), 0 0 20px ${agent.color}20`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isChief ? 'rgba(0,229,255,0.3)' : 'rgba(240,237,232,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = isChief ? '0 0 30px rgba(0,229,255,0.15)' : 'none'
      }}
    >
      {/* Chief badge */}
      {isChief && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          fontSize: '0.55rem', letterSpacing: '0.15em', fontWeight: 700,
          color: '#00e5ff', background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)',
          padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase',
        }}>Chief • Orchestrator</div>
      )}

      {/* Top row: avatar + name + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        {/* Mini orb avatar */}
        <div style={{
          width: isChief ? 56 : 44, height: isChief ? 56 : 44, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${agent.color}ff, ${agent.color}66, rgba(4,8,15,0.9))`,
          border: `2px solid ${agent.color}80`,
          boxShadow: `0 0 16px ${agent.color}60, inset 0 0 12px ${agent.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', flexShrink: 0,
        }}>
          <Bot size={isChief ? 24 : 18} color="#f0ede8" />
          {/* Status dot */}
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 14, height: 14, borderRadius: '50%',
            background: meta.color,
            border: '2px solid #0f172a',
            boxShadow: `0 0 8px ${meta.color}`,
          }}>
            {meta.pulse && (
              <div style={{
                position: 'absolute', inset: -4, borderRadius: '50%',
                border: `1px solid ${meta.color}`,
                animation: 'agent-pulse 1.5s ease-in-out infinite',
              }} />
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <h3 style={{ margin: 0, fontSize: isChief ? '1.05rem' : '0.92rem', fontWeight: 700, color: '#f0ede8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {agent.name}
            </h3>
            <span style={{
              fontSize: '0.58rem', padding: '1px 6px', borderRadius: 4,
              background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}40`,
              fontWeight: 700, letterSpacing: '0.08em',
            }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agent.role}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', color: '#64748b' }}>
            <Cpu size={11} /> {agent.model_default || 'no model'}
            {agent.last_seen && <span style={{ marginLeft: 8 }}>• {timeAgo(agent.last_seen)}</span>}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Stat label="Tasks" value={String(agent.total_tasks ?? 0)} icon={Activity} color="#94a3b8" />
        <Stat label="Success" value={`${agent.success_rate ?? 0}%`} icon={CheckCircle2} color={(agent.success_rate ?? 0) >= 80 ? '#34d399' : '#f5a623'} />
        <Stat label="Cost" value={`$${(agent.total_cost_usd ?? 0).toFixed(2)}`} icon={DollarSign} color="#f5a623" />
      </div>

      {/* Sparkline 24h */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>24h Activity</span>
          <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{agent.running_tasks ?? 0} running • {agent.pending_tasks ?? 0} pending</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28 }}>
          {sparkline.length > 0 ? sparkline.map((v, i) => (
            <div key={i} style={{
              flex: 1, height: `${(v / maxSpark) * 100}%`, minHeight: v > 0 ? 3 : 1,
              background: v > 0 ? `linear-gradient(180deg, ${agent.color}, ${agent.color}88)` : 'rgba(240,237,232,0.06)',
              borderRadius: 2,
              opacity: v > 0 ? 0.8 : 0.3,
            }} />
          )) : (
            <div style={{ width: '100%', height: 1, background: 'rgba(240,237,232,0.08)' }} />
          )}
        </div>
      </div>

      {/* Current task */}
      {agent.current_task_id ? (
        <div style={{
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Loader2 size={12} color="#00e5ff" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '0.7rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {agent.current_task_title || agent.current_task_id}
          </span>
          <span style={{ fontSize: '0.6rem', color: '#00e5ff', fontWeight: 700 }}>RUNNING</span>
        </div>
      ) : (
        <div style={{
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.06)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '0.68rem', color: '#64748b',
        }}>
          <Clock size={11} /> Idle • avg {agent.avg_duration_sec ? `${agent.avg_duration_sec}s` : '—'} per task
        </div>
      )}

      {/* Failed indicator */}
      {(agent.failed_tasks ?? 0) > 0 && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', color: '#ef4444' }}>
          <XCircle size={11} /> {agent.failed_tasks} failed • {agent.completed_tasks} completed
        </div>
      )}

      <style>{`
        @keyframes agent-pulse { 0% { transform: scale(1); opacity: 1 } 100% { transform: scale(1.8); opacity: 0 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
        <Icon size={11} color={color} />
        <span style={{ fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: color }}>{value}</div>
    </div>
  )
}

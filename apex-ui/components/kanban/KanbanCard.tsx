'use client'

/**
 * KanbanCard — satu kartu di kanban board.
 * Menampilkan: priority strip, title, agent, status+priority badge, progress bar,
 * footer (relative time, cost estimate, artifact count).
 */

import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Bot, Clock, AlertTriangle, CheckCircle2, Loader2, Coins, FileText, CircleSlash, Inbox } from 'lucide-react'
import type { TaskState } from '@/lib/client/stores'

interface Props {
  task: TaskState
  onOpen: (id: string) => void
  isOverlay?: boolean
  isDragging?: boolean
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#ef4444',
  medium: '#f5a623',
  low: '#34d399',
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  inbox:     { label: 'INBOX',     color: '#94a3b8', icon: Inbox },
  queued:    { label: 'QUEUED',    color: '#f5a623', icon: Clock },
  running:   { label: 'RUNNING',   color: '#00e5ff', icon: Loader2 },
  review:    { label: 'REVIEW',    color: '#a855f7', icon: AlertTriangle },
  done:      { label: 'DONE',      color: '#34d399', icon: CheckCircle2 },
  failed:    { label: 'FAILED',    color: '#ef4444', icon: AlertTriangle },
  cancelled: { label: 'CANCELLED', color: '#64748b', icon: CircleSlash },
}

function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function KanbanCard({ task, onOpen, isOverlay, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging: hookDragging } = useDraggable({
    id: task.id,
    data: { task, status: task.status },
    disabled: isOverlay,
  })

  const style = useMemo(() => {
    if (isOverlay) {
      return {
        transform: CSS.Translate.toString(transform),
        opacity: 0.9,
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        cursor: 'grabbing',
      } as React.CSSProperties
    }
    return {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging || hookDragging ? 0.4 : 1,
      cursor: hookDragging ? 'grabbing' : 'grab',
    } as React.CSSProperties
  }, [transform, isOverlay, isDragging, hookDragging])

  const priColor = PRIORITY_COLOR[task.priority] || '#94a3b8'
  const statusMeta = STATUS_META[task.status] || STATUS_META.inbox
  const StatusIcon = statusMeta.icon

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        background: 'rgba(15,23,42,0.85)',
        border: '1px solid rgba(240,237,232,0.08)',
        borderRadius: 10,
        padding: '10px 12px 10px 14px',
        marginBottom: 8,
        backdropFilter: 'blur(8px)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.75rem',
        overflow: 'hidden',
        ...style,
      }}
      onMouseEnter={e => {
        if (!hookDragging) {
          e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(240,237,232,0.08)'
        e.currentTarget.style.boxShadow = 'none'
      }}
      onClick={(e) => {
        // Don't open when drag-end just happened (dnd fires click after)
        if (hookDragging) return
        // Hanya buka inspector jika klik pada area kartu, bukan handle
        onOpen(task.id)
      }}
      {...attributes}
      {...listeners}
    >
      {/* Priority strip di kiri */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: priColor,
        boxShadow: `0 0 8px ${priColor}50`,
      }} />

      {/* Top badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: '0.58rem', padding: '1px 5px', borderRadius: 3,
          background: `${priColor}22`, color: priColor,
          border: `1px solid ${priColor}40`,
          fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {task.priority}
        </span>
        <span style={{
          fontSize: '0.58rem', padding: '1px 5px', borderRadius: 3,
          background: `${statusMeta.color}22`, color: statusMeta.color,
          border: `1px solid ${statusMeta.color}40`,
          fontWeight: 600, letterSpacing: '0.1em',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <StatusIcon size={9} color={statusMeta.color} />
          {statusMeta.label}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.05em' }}>
          {task.id.slice(-6)}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontWeight: 500, fontSize: '0.82rem', color: '#f0ede8',
        lineHeight: 1.35,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', marginBottom: 8,
        wordBreak: 'break-word',
      }}>
        {task.title}
      </div>

      {/* Progress bar (running only) */}
      {task.status === 'running' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(240,237,232,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${task.progress || 20}%`,
              background: 'linear-gradient(90deg, #00e5ff, #f5a623)',
              borderRadius: 2,
              boxShadow: '0 0 6px rgba(0,229,255,0.5)',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: 2, textAlign: 'right', letterSpacing: '0.05em' }}>
            {task.progress || 0}%
          </div>
        </div>
      )}

      {/* Agent row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Bot size={11} color="#94a3b8" />
        <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>{task.agent_name || 'Unassigned'}</span>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingTop: 6, borderTop: '1px solid rgba(240,237,232,0.06)',
        fontSize: '0.62rem', color: '#64748b',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} /> {timeAgo(task.created_at)}
        </span>
        {task.cost_estimate_usd != null && task.cost_estimate_usd > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Coins size={10} /> ${task.cost_estimate_usd.toFixed(3)}
          </span>
        )}
        {task.artifact_count != null && task.artifact_count > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <FileText size={10} /> {task.artifact_count}
          </span>
        )}
        {task.error_message && task.status === 'failed' && (
          <span style={{ color: '#ef4444', marginLeft: 'auto', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.error_message}>
            {task.error_message.slice(0, 24)}…
          </span>
        )}
      </div>
    </div>
  )
}

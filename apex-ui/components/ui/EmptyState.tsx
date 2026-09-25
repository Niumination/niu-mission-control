'use client'

/**
 * EmptyState — reusable empty state dengan icon, title, description, action
 */

import React from 'react'
import { Inbox, Search, AlertCircle, FileX, Bot } from 'lucide-react'

type Variant = 'no-data' | 'no-results' | 'error' | 'no-tasks' | 'no-agents'

interface Props {
  variant?: Variant
  icon?: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  style?: React.CSSProperties
}

const VARIANT_META: Record<Variant, { icon: any; title: string; description: string }> = {
  'no-data': { icon: Inbox, title: 'No data yet', description: 'There is no data to display. Data will appear here once available.' },
  'no-results': { icon: Search, title: 'No results', description: 'No results match your current filters. Try adjusting search or filters.' },
  'error': { icon: AlertCircle, title: 'Failed to load', description: 'Could not load data. Please try again.' },
  'no-tasks': { icon: FileX, title: 'No tasks', description: 'No tasks in this column. Drag tasks here or create a new one.' },
  'no-agents': { icon: Bot, title: 'No agents', description: 'No agents found. Check agent registry or seed defaults.' },
}

export default function EmptyState({ variant = 'no-data', icon, title, description, actionLabel, onAction, style }: Props) {
  const meta = VARIANT_META[variant]
  const Icon = icon || meta.icon

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', textAlign: 'center',
      background: 'rgba(15,23,42,0.3)', border: '1px dashed rgba(240,237,232,0.1)', borderRadius: 12,
      fontFamily: '"JetBrains Mono", monospace',
      ...style,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'rgba(240,237,232,0.04)', border: '1px solid rgba(240,237,232,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      }}>
        <Icon size={24} color="#64748b" style={{ opacity: 0.8 }} />
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: '0.9rem', fontWeight: 700, color: '#f0ede8' }}>{title || meta.title}</h3>
      <p style={{ margin: '0 0 16px', fontSize: '0.72rem', color: '#94a3b8', maxWidth: 360, lineHeight: 1.5 }}>{description || meta.description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction}
          style={{
            padding: '8px 14px', borderRadius: 8,
            background: 'linear-gradient(90deg, #00e5ff, #a855f7)', border: 'none',
            color: '#04080f', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

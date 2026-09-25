'use client'

/**
 * CommandPalette — ⌘K modal berbasis cmdk.
 * Fitur saat ini:
 *   - Navigasi ke semua halaman
 *   - Search task (dari Zustand store) → pilih untuk menutup (inspector task akan dibuat di M6)
 *   - Jump ke agent (cukup pilih, untuk saat ini ke /agents)
 *   - Quick action: Create task (dispatch dengan title input ke chief)
 *
 * Shortcut: ⌘K / Ctrl+K membuka; Escape menutup.
 */

import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, KanbanSquare, Bot, Activity, BarChart3, ScrollText, Settings,
  PlusCircle, Search as SearchIcon, CornerDownLeft,
} from 'lucide-react'
import { useTasksStore, useAgentsStore } from '@/lib/client/stores'
import { toast } from '../ui/Toast'

interface Props { open: boolean; onClose: () => void }

const PAGE_ITEMS = [
  { id: 'nav-overview',  label: 'Go to Overview',  keywords: 'home main dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'nav-missions',  label: 'Go to Missions',  keywords: 'kanban tasks queue board', icon: KanbanSquare, href: '/missions' },
  { id: 'nav-agents',    label: 'Go to Agents',    keywords: 'chief research programmer qa creator workers', icon: Bot, href: '/agents' },
  { id: 'nav-live',      label: 'Go to Live Ops',  keywords: 'terminal logs realtime', icon: Activity, href: '/live-ops' },
  { id: 'nav-analytics', label: 'Go to Analytics', keywords: 'metrics cost tokens charts', icon: BarChart3, href: '/analytics' },
  { id: 'nav-audit',     label: 'Go to Audit Log', keywords: 'events history logs', icon: ScrollText, href: '/audit' },
  { id: 'nav-settings',  label: 'Go to Settings',  keywords: 'config preferences', icon: Settings, href: '/settings' },
]

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter()
  const tasks = useTasksStore(s => Object.values(s.tasks))
  const agents = useAgentsStore(s => Object.values(s.agents))
  const [value, setValue] = useState('')
  const [createMode, setCreateMode] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  // Lock scroll saat terbuka
  useEffect(() => {
    if (!open) {
      setCreateMode(false)
      setNewTitle('')
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Shortcut "/" pada page akan buka palette (selain input fields)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '/' && open === false) {
        const t = e.target as HTMLElement
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
        e.preventDefault()
        // dipicu dari parent; tidak membuka sendiri di sini (parent AppShell yang handle ⌘K)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  const recentTasks = useMemo(() =>
    [...tasks].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10)
  , [tasks])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      const res = await fetch('/api/mc/dispatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, instruction: newTitle, priority: 'medium' }),
      })
      const data = await res.json()
      if (data.id) {
        toast.success(`Task dispatched: ${newTitle.slice(0, 40)}`)
        setNewTitle('')
        setCreateMode(false)
        onClose()
        router.push('/missions')
      } else {
        toast.error(data.error || 'Failed to dispatch')
      }
    } catch {
      toast.error('Network error dispatching task')
    }
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(4,8,15,0.6)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
        fontFamily: '"JetBrains Mono", monospace',
        animation: 'cmdkg-fade 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(640px, 92vw)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(4,8,15,0.98))',
          border: '1px solid rgba(0,229,255,0.25)',
          borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px rgba(0,229,255,0.08)',
          overflow: 'hidden',
        }}
      >
        {createMode ? (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <PlusCircle size={18} color="#00e5ff" />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                New task → chief
              </span>
            </div>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setCreateMode(false)
              }}
              placeholder="Tulis instruksi task… (Enter untuk dispatch)"
              style={{
                width: '100%', padding: '10px 0',
                background: 'transparent', border: 'none', outline: 'none',
                color: '#f0ede8', fontSize: '0.95rem',
                fontFamily: 'inherit',
                borderBottom: '1px solid rgba(240,237,232,0.1)',
              }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCreateMode(false)}
                style={{ padding: '6px 12px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(240,237,232,0.15)', borderRadius: 6, fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >Cancel</button>
              <button
                onClick={handleCreate}
                style={{ padding: '6px 14px', background: '#00e5ff', color: '#04080f', border: 'none', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >Dispatch ↵</button>
            </div>
          </div>
        ) : (
          <Command
            label="Command Palette"
            value={value}
            onValueChange={setValue}
            loop
            style={{ outline: 'none' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && value.trim()) {
                // quick-create jika tidak ada result yang match? biarkan cmdk handle
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(240,237,232,0.08)' }}>
              <SearchIcon size={18} color="#64748b" />
              <Command.Input
                autoFocus
                placeholder="Type a command or search…"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#f0ede8', fontSize: '0.9rem', fontFamily: 'inherit', letterSpacing: '0.01em',
                }}
              />
              <kbd style={{
                fontFamily: 'inherit', fontSize: '0.62rem',
                padding: '2px 6px', borderRadius: 4,
                border: '1px solid rgba(240,237,232,0.15)',
                color: '#94a3b8',
              }}>ESC</kbd>
            </div>

            <Command.List style={{ maxHeight: 400, overflow: 'auto', padding: 8 }}>
              <Command.Empty style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                No results. Press <kbd style={{ fontFamily: 'inherit', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(240,237,232,0.2)' }}>Enter</kbd> to dispatch as task, or <kbd style={{ fontFamily: 'inherit', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(240,237,232,0.2)' }}>Esc</kbd> to close.
                {value.trim() && (
                  <button
                    onClick={() => { setNewTitle(value); setCreateMode(true) }}
                    style={{ display: 'block', margin: '12px auto 0', padding: '8px 14px', background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)', borderRadius: 6, color: '#00e5ff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    <PlusCircle size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                    Create &ldquo;{value.slice(0, 30)}&rdquo;
                  </button>
                )}
              </Command.Empty>

              <Command.Group heading="Quick Actions" style={{ fontSize: '0.65rem', color: '#64748b', padding: '6px 8px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                <Command.Item
                  value="create-task"
                  onSelect={() => setCreateMode(true)}
                  style={itemStyle()}
                >
                  <PlusCircle size={16} color="#00e5ff" />
                  <span>Create new task…</span>
                  <span style={kbdStyle()}><CornerDownLeft size={11} /> Enter</span>
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Navigate" style={{ fontSize: '0.65rem', color: '#64748b', padding: '6px 8px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                {PAGE_ITEMS.map(p => {
                  const I = p.icon
                  return (
                    <Command.Item key={p.id} value={p.label + ' ' + p.keywords}
                      onSelect={() => { router.push(p.href); onClose() }}
                      style={itemStyle()}
                    >
                      <I size={16} />
                      <span>{p.label}</span>
                    </Command.Item>
                  )
                })}
              </Command.Group>

              {recentTasks.length > 0 && (
                <Command.Group heading="Recent Tasks" style={{ fontSize: '0.65rem', color: '#64748b', padding: '6px 8px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  {recentTasks.map(t => (
                    <Command.Item key={t.id} value={t.id + ' ' + t.title} keywords={[t.title]}
                      onSelect={() => { router.push('/missions'); onClose(); toast.info(`Opening task ${t.id} — inspector coming in M6`) }}
                      style={itemStyle()}
                    >
                      <KanbanSquare size={14} color={statusColor(t.status)} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <span style={{ fontSize: '0.62rem', color: statusColor(t.status), letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.status}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {agents.length > 0 && (
                <Command.Group heading="Agents" style={{ fontSize: '0.65rem', color: '#64748b', padding: '6px 8px', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  {agents.map(a => (
                    <Command.Item key={a.id} value={a.id + ' ' + a.name} keywords={[a.name, a.role]}
                      onSelect={() => { router.push('/agents'); onClose() }}
                      style={itemStyle()}
                    >
                      <Bot size={14} color={a.status === 'working' ? '#00e5ff' : a.status === 'error' ? '#ef4444' : a.status === 'offline' ? '#64748b' : '#f5a623'} />
                      <span style={{ flex: 1 }}>{a.name}</span>
                      <span style={{ fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{a.status}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        )}
      </div>
      <style>{`
        @keyframes cmdkg-fade { from { opacity: 0 } to { opacity: 1 } }
        [cmdk-root] [cmdk-item][data-selected="true"] {
          background: linear-gradient(90deg, rgba(0,229,255,0.15), rgba(245,166,35,0.05)) !important;
          color: #f0ede8 !important;
          border-color: rgba(0,229,255,0.4) !important;
        }
        [cmdk-root] [cmdk-item] { cursor: pointer; }
        [cmdk-root] [cmdk-group-heading] { padding: 8px 8px 4px; }
      `}</style>
    </div>
  )
}

function itemStyle(): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', margin: '1px 0',
    borderRadius: 6,
    color: '#cbd5e1', fontSize: '0.8rem',
    border: '1px solid transparent',
    transition: 'all 0.12s',
    fontFamily: 'inherit',
  }
}

function kbdStyle(): React.CSSProperties {
  return {
    marginLeft: 'auto',
    fontFamily: 'inherit', fontSize: '0.62rem',
    padding: '2px 6px', borderRadius: 4,
    border: '1px solid rgba(240,237,232,0.15)',
    color: '#94a3b8',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }
}

function statusColor(s: string): string {
  switch (s) {
    case 'running': return '#00e5ff'
    case 'queued': case 'inbox': return '#f5a623'
    case 'review': return '#a855f7'
    case 'done': return '#34d399'
    case 'failed': return '#ef4444'
    default: return '#94a3b8'
  }
}

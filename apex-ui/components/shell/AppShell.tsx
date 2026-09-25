'use client'

/**
 * AppShell — sidebar (collapsible) + topbar untuk semua halaman (kecuali login/setup).
 * Fitur:
 *   - Sidebar kiri dengan 7 icon nav (Overview, Missions, Agents, Live Ops, Analytics, Audit Log, Settings)
 *   - Active indicator sesuai route
 *   - Collapse/expand (ke icon-only mode) dengan transisi
 *   - Topbar: breadcrumb, jam+cuaca (placeholder), connection dot, bell (notifications badge approvals/alerts), tombol collapse
 *   - Mini-Orb di bagian atas sidebar (sudah dipisah dari MiniOrbDock floating)
 *   - Keyboard Escape → kembali ke Overview
 *   - ⌘K / Ctrl+K untuk membuka command palette (palette sendiri di komponen CommandPalette)
 *
 * Catatan:
 *   - Anak (children) di-render di area kanan dengan overflow-y otomatis
 *   - Background body transparan, page yang di-dalam yang set backgroundnya
 */

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, KanbanSquare, Bot, Activity, BarChart3, ScrollText,
  Settings, Menu, Bell, ChevronRight, Search, Wifi, WifiOff,
} from 'lucide-react'
import { useOrbState } from '@/lib/client/useOrbState'
import CommandPalette from './CommandPalette'
import { toast } from '../ui/Toast'

// ── Nav definitions ───────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  short: string // label singkat untuk icon-only mode
  accent?: string
}

const NAV: NavItem[] = [
  { href: '/',          label: 'Overview',   icon: LayoutDashboard, short: 'OV', accent: '#00e5ff' },
  { href: '/missions',  label: 'Missions',   icon: KanbanSquare,    short: 'MS', accent: '#f5a623' },
  { href: '/agents',    label: 'Agents',     icon: Bot,            short: 'AG', accent: '#a855f7' },
  { href: '/live-ops',  label: 'Live Ops',   icon: Activity,       short: 'LO', accent: '#22d3ee' },
  { href: '/analytics', label: 'Analytics',  icon: BarChart3,      short: 'AN', accent: '#34d399' },
  { href: '/audit',     label: 'Audit Log',  icon: ScrollText,     short: 'AU', accent: '#94a3b8' },
  { href: '/settings',  label: 'Settings',   icon: Settings,       short: 'ST', accent: '#f472b6' },
]

const SIDEBAR_W_EXPANDED = 210
const SIDEBAR_W_COLLAPSED = 64

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const orb = useOrbState()
  const [collapsed, setCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [connected] = useState(true) // TODO: baca dari useHealthStore saat itu sudah ready

  // Jam real-time
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ⌘K / Ctrl+K → buka command palette; Escape → pulang ke overview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac/i.test(navigator.platform)
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
      if (e.key === 'Escape') {
        if (paletteOpen) { setPaletteOpen(false); return }
        if (pathname !== '/') router.push('/')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pathname, paletteOpen, router])

  // Persist collapse preference (localStorage)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mc:sidebar:collapsed')
      if (saved === '1') setCollapsed(true)
    } catch { /* noop */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('mc:sidebar:collapsed', collapsed ? '1' : '0') } catch { /* noop */ }
  }, [collapsed])

  const sidebarW = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED
  const approvalCount = orb.approvalsCount
  const errorCount = orb.errorsCount
  const hasAlert = approvalCount > 0 || errorCount > 0

  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })

  // Breadcrumb dari pathname
  const crumbs = (() => {
    if (pathname === '/') return ['Overview']
    const item = NAV.find(n => n.href === pathname)
    return ['Mission Control', item?.label ?? pathname.slice(1)]
  })()

  const navItem = (item: NavItem) => {
    const active = pathname === item.href
    const I = item.icon
    return (
      <button
        key={item.href}
        onClick={() => router.push(item.href)}
        title={collapsed ? item.label : undefined}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: collapsed ? '10px 0' : '10px 14px',
          margin: '2px 10px',
          borderRadius: 8,
          border: 'none',
          background: active ? `linear-gradient(90deg, ${item.accent}22, transparent)` : 'transparent',
          color: active ? item.accent : '#94a3b8',
          cursor: 'pointer',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.78rem',
          fontWeight: active ? 600 : 500,
          letterSpacing: '0.05em',
          transition: 'all 0.2s',
          justifyContent: collapsed ? 'center' : 'flex-start',
          width: collapsed ? 44 : 'calc(100% - 20px)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => {
          if (!active) {
            e.currentTarget.style.background = 'rgba(240,237,232,0.05)'
            e.currentTarget.style.color = '#f0ede8'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#94a3b8'
          }
        }}
      >
        {/* Active indicator bar (kiri) */}
        {active && (
          <span style={{
            position: 'absolute', left: -10, top: 6, bottom: 6, width: 3,
            background: item.accent, borderRadius: 2,
            boxShadow: `0 0 8px ${item.accent}`,
          }} />
        )}
        <I size={18} color={active ? item.accent : undefined} strokeWidth={active ? 2.2 : 1.8} />
        {!collapsed && <span style={{ textTransform: 'uppercase' }}>{item.label}</span>}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#04080f', color: '#f0ede8' }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{
        width: sidebarW,
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(4,8,15,0.98))',
        borderRight: '1px solid rgba(240,237,232,0.08)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(.4,0,.2,1)',
        position: 'relative',
        zIndex: 50,
        fontFamily: '"JetBrains Mono", monospace',
        overflow: 'hidden',
      }}>
        {/* Logo / brand */}
        <div style={{
          padding: collapsed ? '18px 0 14px' : '18px 16px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid rgba(240,237,232,0.06)',
          marginBottom: 6,
        }}>
          {/* Mini orb logo */}
          <svg width={30} height={30} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
            <circle cx={32} cy={32} r={22} fill="none" stroke="#00e5ff" strokeWidth={1.2} opacity={0.4} />
            <circle cx={32} cy={32} r={15} fill="none" stroke="#f5a623" strokeWidth={1} opacity={0.5} />
            <circle cx={32} cy={32} r={7} fill="#00e5ff" style={{ filter: 'drop-shadow(0 0 6px #00e5ff)' }} />
            <circle cx={32} cy={32} r={3} fill="#ffffff" opacity={0.8} />
          </svg>
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.08em', color: '#f0ede8' }}>NIU</span>
              <span style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.15em' }}>MISSION CTRL</span>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8, overflow: 'hidden' }}>
          {NAV.map(navItem)}
        </nav>

        {/* Footer: status mini */}
        <div style={{
          padding: collapsed ? 12 : '14px 16px',
          borderTop: '1px solid rgba(240,237,232,0.06)',
          display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8,
          justifyContent: collapsed ? 'center' : 'flex-start',
          fontSize: '0.65rem',
          color: connected ? '#34d399' : '#ef4444',
        }}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {!collapsed && <span style={{ letterSpacing: '0.1em' }}>{connected ? 'CONNECTED' : 'OFFLINE'}</span>}
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* ── Topbar ─────────────────────────────────────── */}
        <header style={{
          height: 52,
          flexShrink: 0,
          background: 'rgba(4,8,15,0.8)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(240,237,232,0.07)',
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '0 20px',
          fontFamily: '"JetBrains Mono", monospace',
          zIndex: 40,
          position: 'sticky', top: 0,
        }}>
          {/* Collapse button */}
          <button
            onClick={() => setCollapsed(c => !c)}
            aria-label="Toggle sidebar"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#94a3b8', padding: 6, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f0ede8'; e.currentTarget.style.background = 'rgba(240,237,232,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent' }}
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#94a3b8' }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <ChevronRight size={12} color="#4b5563" />}
                <span style={{
                  color: i === crumbs.length - 1 ? '#f0ede8' : '#94a3b8',
                  fontWeight: i === crumbs.length - 1 ? 600 : 400,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>{c}</span>
              </span>
            ))}
          </div>

          {/* Search / command palette trigger */}
          <button
            onClick={() => setPaletteOpen(true)}
            style={{
              marginLeft: 16,
              flex: 1, maxWidth: 380,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 12px',
              background: 'rgba(240,237,232,0.04)',
              border: '1px solid rgba(240,237,232,0.1)',
              borderRadius: 8,
              color: '#64748b',
              fontFamily: 'inherit',
              fontSize: '0.72rem',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.35)'; e.currentTarget.style.color = '#94a3b8' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.1)'; e.currentTarget.style.color = '#64748b' }}
          >
            <Search size={14} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search tasks, agents, commands…</span>
            <kbd style={{
              fontFamily: 'inherit', fontSize: '0.62rem',
              padding: '2px 6px', borderRadius: 4,
              border: '1px solid rgba(240,237,232,0.15)',
              color: '#94a3b8',
              background: 'rgba(240,237,232,0.04)',
            }}>⌘K</kbd>
          </button>

          <div style={{ flex: 1 }} />

          {/* Clock */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1, gap: 2 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f0ede8', letterSpacing: '0.1em' }}>{timeStr}</span>
            <span style={{ fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{dateStr}</span>
          </div>

          {/* Bell */}
          <button
            onClick={() => { toast.info(`You have ${approvalCount} approval${approvalCount === 1 ? '' : 's'} + ${errorCount} alert${errorCount === 1 ? '' : 's'}`) }}
            aria-label="Notifications"
            style={{
              position: 'relative',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: hasAlert ? '#f5a623' : '#94a3b8', padding: 8, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,237,232,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Bell size={18} />
            {hasAlert && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 8, height: 8, borderRadius: '50%',
                background: approvalCount > 0 ? '#f5a623' : '#ef4444',
                boxShadow: `0 0 8px ${approvalCount > 0 ? '#f5a623' : '#ef4444'}`,
                animation: 'mc-bell-pulse 1.5s ease-in-out infinite',
              }} />
            )}
          </button>

          {/* Connection dot */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.65rem', color: connected ? '#34d399' : '#ef4444',
            letterSpacing: '0.1em',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? '#34d399' : '#ef4444',
              boxShadow: `0 0 8px ${connected ? '#34d399' : '#ef4444'}`,
            }} />
            <span style={{ textTransform: 'uppercase' }}>{connected ? 'LIVE' : 'DOWN'}</span>
          </div>
        </header>

        {/* ── Page content ──────────────────────────────── */}
        <main style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <style>{`
        @keyframes mc-bell-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}

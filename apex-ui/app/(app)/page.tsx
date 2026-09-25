'use client'
import { useState } from 'react'
import ApexWorld from "@/components/ApexWorld";
import ApexOverviewPanel from "@/components/ApexOverviewPanel";
import TaskPanel from "@/components/TaskPanel";
import BottomDrawer from "@/components/BottomDrawer";
import ActivityFeed from "@/components/ActivityFeed";
import ConnectionStatus from "@/components/ConnectionStatus";
import { useTasksStore } from '@/lib/client/stores'

export default function Home() {
  // SSE diinisialisasi di AppShell layout via useEventStream() singleton (guard ref).

  const [showTaskPanel, setShowTaskPanel] = useState(false)
  const [showBottomDrawer, setShowBottomDrawer] = useState(false)

  // Task count = inbox + queued + running (yang butuh perhatian)
  const activeCount = useTasksStore(s => {
    return Object.values(s.tasks).filter(t =>
      t.status === 'inbox' || t.status === 'queued' || t.status === 'running' || t.status === 'review'
    ).length
  })
  const runningCount = useTasksStore(s => Object.values(s.tasks).filter(t => t.status === 'running').length)

  return (
    <main
      id="main"
      style={{ background: "#04080f", color: "#f0ede8", position: "relative", overflow: "hidden" }}
    >
      {/* Overview Panel (top-left: clock/weather/menu tiles) */}
      <ApexOverviewPanel />

      {/* Connection status dot + label — top-right, di atas tombol */}
      <div style={{
        position: 'absolute', top: 24, right: 24, zIndex: 110,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <ConnectionStatus />
        {runningCount > 0 && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.65rem',
            color: '#00e5ff',
            letterSpacing: '0.1em',
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(0,229,255,0.12)',
            border: '1px solid rgba(0,229,255,0.3)',
          }}>
            {runningCount} running
          </span>
        )}
      </div>

      {/* Task Queue Button - Top Right */}
      <button
        onClick={() => setShowTaskPanel(true)}
        style={{
          position: 'absolute',
          top: 56,
          right: 390, // geser ke kiri agar tidak tabrakan dengan stat cards (width 360 + gap 20)
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.15), rgba(245, 166, 35, 0.1))',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: 8,
          color: '#00e5ff',
          cursor: 'pointer',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          transition: 'all 0.2s',
          boxShadow: '0 4px 20px rgba(0, 229, 255, 0.1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(90deg, rgba(0, 229, 255, 0.25), rgba(245, 166, 35, 0.15))';
          e.currentTarget.style.borderColor = '#00e5ff';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 229, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(90deg, rgba(0, 229, 255, 0.15), rgba(245, 166, 35, 0.1))';
          e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.3)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 229, 255, 0.1)';
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(0, 229, 255, 0.2)', border: '1px solid rgba(0, 229, 255, 0.4)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#00e5ff' }}>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </span>
        <span>TASK QUEUE</span>
        <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(0, 229, 255, 0.2)', borderRadius: 4, color: '#00e5ff', minWidth: 24, textAlign: 'center' }}>
          {activeCount}
        </span>
      </button>

      {/* Menu Button - Top Right (below task queue) */}
      <button
        onClick={() => setShowBottomDrawer(true)}
        style={{
          position: 'absolute',
          top: 106,
          right: 390,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'linear-gradient(90deg, rgba(245, 166, 35, 0.15), rgba(0, 229, 255, 0.1))',
          border: '1px solid rgba(245, 166, 35, 0.3)',
          borderRadius: 8,
          color: '#f5a623',
          cursor: 'pointer',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          transition: 'all 0.2s',
          boxShadow: '0 4px 20px rgba(245, 166, 35, 0.1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(90deg, rgba(245, 166, 35, 0.25), rgba(0, 229, 255, 0.15))';
          e.currentTarget.style.borderColor = '#f5a623';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(245, 166, 35, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(90deg, rgba(245, 166, 35, 0.15), rgba(0, 229, 255, 0.1))';
          e.currentTarget.style.borderColor = 'rgba(245, 166, 35, 0.3)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(245, 166, 35, 0.1)';
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'rgba(245, 166, 35, 0.2)', border: '1px solid rgba(245, 166, 35, 0.4)' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#f5a623' }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </span>
        <span>MENU</span>
      </button>

      {/* Activity Feed — bottom-right HUD */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 340,
        height: 240,
        zIndex: 90,
      }}>
        <ActivityFeed maxItems={20} />
      </div>

      {/* Apex World Orb */}
      <section style={{ position: "relative", height: "100vh", minHeight: 620 }}>
        <ApexWorld />
      </section>

      {/* Task Panel - Slide-in from Right */}
      <TaskPanel
        isOpen={showTaskPanel}
        onClose={() => setShowTaskPanel(false)}
        onTaskCreated={() => { /* akan di-update otomatis via SSE; tidak perlu refetch manual */ }}
      />

      {/* Bottom Drawer - Slide-up Menu */}
      <BottomDrawer
        isOpen={showBottomDrawer}
        onClose={() => setShowBottomDrawer(false)}
      />

      {/* Global keyframes untuk pulse dot */}
      <style jsx global>{`
        @keyframes mc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </main>
  )
}

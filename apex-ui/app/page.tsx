'use client'
import { useState, useEffect } from 'react'
import ApexWorld from "@/components/ApexWorld";
import ApexOverviewPanel from "@/components/ApexOverviewPanel";
import TaskPanel from "@/components/TaskPanel";
import BottomDrawer from "@/components/BottomDrawer";

interface Agent {
  id: string
  name: string
  role: string
  model: string
  status: string
  color: string
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
}

interface Task {
  id: string
  title: string
  description: string | null
  agent_id: string | null
  status: string
  priority: string
  progress: number
  created_at: string
  agent_name: string | null
}

interface Health {
  status: string
  database: string
  version: string
  uptime: number
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTaskPanel, setShowTaskPanel] = useState(false)
  const [showBottomDrawer, setShowBottomDrawer] = useState(false)

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/mc/agents')
      const data = await res.json()
      setAgents(data.agents || [])
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    }
  }

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/mc/tasks')
      const data = await res.json()
      setTasks([...(data.pending || []), ...(data.running || []), ...(data.completed || []), ...(data.failed || [])])
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
  }

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/mc/health')
      const data = await res.json()
      setHealth(data)
    } catch (err) {
      console.error('Failed to fetch health:', err)
    }
  }

  useEffect(() => {
    Promise.all([fetchAgents(), fetchTasks(), fetchHealth()]).then(() => setLoading(false))
  }, [])

  const handleTaskCreated = () => {
    fetchTasks()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#04080f' }}>
        <div style={{ color: '#94a3b8', fontSize: '1.2rem' }}>Loading Mission Control...</div>
      </div>
    )
  }

  return (
    <main
      id="main"
      style={{ background: "#04080f", color: "#f0ede8", position: "relative", overflow: "hidden" }}
    >
      {/* Overview Panel */}
      <ApexOverviewPanel />

      {/* Task Queue Button - Top Right */}
      <button
        onClick={() => setShowTaskPanel(true)}
        style={{
          position: 'absolute',
          top: 80,
          right: 20,
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
          {tasks.length}
        </span>
      </button>

      {/* Menu Button - Top Right (below task queue) */}
      <button
        onClick={() => setShowBottomDrawer(true)}
        style={{
          position: 'absolute',
          top: 130,
          right: 20,
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

      {/* Apex World Orb */}
      <section style={{ position: "relative", height: "100vh", minHeight: 620 }}>
        <ApexWorld />
      </section>

      {/* Task Panel - Slide-in from Right */}
      <TaskPanel
        isOpen={showTaskPanel}
        onClose={() => setShowTaskPanel(false)}
        onTaskCreated={handleTaskCreated}
      />

      {/* Bottom Drawer - Slide-up Menu */}
      <BottomDrawer
        isOpen={showBottomDrawer}
        onClose={() => setShowBottomDrawer(false)}
      />
    </main>
  )
}
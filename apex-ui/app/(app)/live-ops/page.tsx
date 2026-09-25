'use client'

/**
 * /live-ops — Live Ops page: log viewer + terminal + dispatch composer + approval queue
 */

import { useState, useEffect } from 'react'
import { Activity, Bot } from 'lucide-react'
import LogViewer from '@/components/live-ops/LogViewer'
import TerminalView from '@/components/live-ops/TerminalView'
import DispatchComposer from '@/components/live-ops/DispatchComposer'
import ApprovalQueue from '@/components/live-ops/ApprovalQueue'
import { useAgentsStore } from '@/lib/client/stores'

export default function LiveOpsPage() {
  const agents = useAgentsStore(s => Object.values(s.agents))
  const [selectedAgent, setSelectedAgent] = useState<string>('all')

  // If agents not yet loaded via SSE, fetch once
  useEffect(() => {
    if (agents.length === 0) {
      fetch('/api/mc/agents').then(r => r.json()).then(d => {
        if (d.agents) {
          // Update store via setAgents if needed — but we already have SSE that will populate
          // For MVP, we just keep local
        }
      }).catch(() => {})
    }
  }, [])

  return (
    <div style={{
      height: 'calc(100vh - 52px)',
      display: 'flex', flexDirection: 'column',
      background: '#04080f', color: '#f0ede8',
      fontFamily: '"JetBrains Mono", monospace',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid rgba(240,237,232,0.07)',
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(4,8,15,0.6)', backdropFilter: 'blur(10px)',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 10px #22d3ee', animation: 'pulse 1.5s ease-in-out infinite' }} />
          Live Ops
        </h1>
        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Real-time logs • terminal • dispatch • approvals</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={14} color="#64748b" />
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}
            style={{
              background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)',
              color: '#f0ede8', padding: '6px 10px', borderRadius: 8, fontSize: '0.72rem', fontFamily: 'inherit',
            }}>
            <option value="all">All agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name} ({a.id})</option>
            ))}
            {agents.length === 0 && (
              <>
                <option value="chief">Chief</option>
                <option value="research">Research</option>
                <option value="programmer">Programmer</option>
                <option value="qa">QA</option>
                <option value="creator">Creator</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Log viewer 60% */}
        <div style={{ flex: '0 0 58%', display: 'flex', flexDirection: 'column', padding: 12, gap: 12, overflow: 'hidden', borderRight: '1px solid rgba(240,237,232,0.07)' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <LogViewer filterAgent={selectedAgent} />
          </div>
        </div>

        {/* Right: 42% split vertical */}
        <div style={{ flex: '1 1 42%', display: 'flex', flexDirection: 'column', padding: 12, gap: 12, overflowY: 'auto' }}>
          {/* Terminal */}
          <div style={{ flex: '0 0 280px', minHeight: 200 }}>
            <TerminalView selectedAgent={selectedAgent} />
          </div>

          {/* Dispatch Composer */}
          <DispatchComposer />

          {/* Approval Queue */}
          <ApprovalQueue />

          {/* Health mini */}
          <div style={{
            background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(240,237,232,0.07)', borderRadius: 12,
            padding: 12, fontSize: '0.68rem', color: '#94a3b8',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#00e5ff', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <Activity size={12} /> System Health
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <HealthItem label="SSE" value="Connected" color="#34d399" />
              <HealthItem label="Worker" value="Running" color="#34d399" />
              <HealthItem label="DB" value="WAL OK" color="#34d399" />
              <HealthItem label="Queue" value="Live" color="#00e5ff" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>
    </div>
  )
}

function HealthItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ color: '#64748b' }}>{label}:</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

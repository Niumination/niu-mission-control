'use client'

/**
 * /agents — Grid 5 agent + chief highlight + detail drawer
 */

import { useEffect, useState } from 'react'
import { Bot, RefreshCw, Search } from 'lucide-react'
import AgentCard, { AgentCardData } from '@/components/agents/AgentCard'
import AgentDetail from '@/components/agents/AgentDetail'

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/mc/agents')
      const data = await res.json()
      if (data.agents) setAgents(data.agents)
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAgents()
    const id = setInterval(fetchAgents, 8000)
    return () => clearInterval(id)
  }, [])

  const filtered = agents.filter(a => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (a.name + ' ' + a.role + ' ' + a.id).toLowerCase().includes(q)
  })

  const chief = filtered.find(a => a.id === 'chief')
  const others = filtered.filter(a => a.id !== 'chief')

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      padding: '20px 24px 40px',
      background: '#04080f',
      color: '#f0ede8',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 10px #a855f7' }} />
          Agents Fleet
        </h1>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{agents.length} agents • {agents.filter(a => a.status === 'working').length} working</span>
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 8,
          background: 'rgba(240,237,232,0.04)', border: '1px solid rgba(240,237,232,0.1)',
          minWidth: 220,
        }}>
          <Search size={14} color="#64748b" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0ede8', fontSize: '0.75rem', fontFamily: 'inherit' }} />
        </div>
        <button onClick={() => { setRefreshing(true); fetchAgents() }}
          style={{
            padding: '7px 12px', borderRadius: 8,
            background: 'rgba(240,237,232,0.04)', border: '1px solid rgba(240,237,232,0.1)',
            color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'inherit', fontSize: '0.7rem',
          }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 220, background: 'rgba(240,237,232,0.03)', borderRadius: 14, border: '1px solid rgba(240,237,232,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Chief row */}
          {chief && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Orchestrator</div>
              <div style={{ maxWidth: 520 }}>
                <AgentCard agent={chief} onClick={() => setSelectedId(chief.id)} isChief />
              </div>
            </div>
          )}

          {/* Others grid */}
          <div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Specialists • {others.length}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {others.map(a => (
                <AgentCard key={a.id} agent={a} onClick={() => setSelectedId(a.id)} />
              ))}
            </div>
            {others.length === 0 && !chief && (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: '0.8rem' }}>
                <Bot size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                No agents found
              </div>
            )}
          </div>
        </>
      )}

      <AgentDetail agentId={selectedId} onClose={() => setSelectedId(null)} onUpdated={fetchAgents} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }
      `}</style>
    </div>
  )
}

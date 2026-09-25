'use client'

/**
 * TerminalView — read-only terminal styled view menampilkan stdout dari agent aktif
 * Untuk MVP, render sebagai div pre dengan ANSI-like coloring, auto-scroll
 */

import { useEffect, useRef, useState } from 'react'
import { Terminal, Maximize2, Copy, Trash2 } from 'lucide-react'
import { useActivityStore, useTasksStore } from '@/lib/client/stores'

interface Props {
  selectedAgent: string
}

export default function TerminalView({ selectedAgent }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const activityEvents = useActivityStore(s => s.events)
  const tasks = useTasksStore(s => s.tasks)

  // Simulate terminal output from activity events
  useEffect(() => {
    const newLines: string[] = []
    const relevantEvents = activityEvents.slice(-30)

    for (const ev of relevantEvents) {
      if (selectedAgent !== 'all' && (ev.payload as any)?.agent !== selectedAgent && ev.aggregate_id !== selectedAgent) {
        // Skip if filtering by agent and event not matching
        if (ev.aggregate_type === 'task') {
          const task = tasks[ev.aggregate_id]
          if (task && task.assigned_agent !== selectedAgent) continue
        } else if (ev.aggregate_type === 'agent' && ev.aggregate_id !== selectedAgent) {
          continue
        }
      }

      const time = new Date(ev.created_at).toLocaleTimeString()
      let line = ''
      switch (ev.type) {
        case 'task.queued':
          line = `[${time}] [${(ev.payload as any)?.agent || 'system'}] 📥 Queued: ${(ev.payload as any)?.title || ev.aggregate_id}`
          break
        case 'task.claimed':
          line = `[${time}] [${ev.aggregate_id}] 🤖 Claimed by ${(ev.payload as any)?.agent || 'agent'}`
          break
        case 'task.started':
        case 'task.running':
          line = `[${time}] [${ev.aggregate_id}] ⚡ Running…`
          break
        case 'task.progress':
          line = `[${time}] [${ev.aggregate_id}] ⏳ Progress: ${(ev.payload as any)?.progress || 0}%`
          break
        case 'task.completed':
        case 'task.done':
          line = `[${time}] [${ev.aggregate_id}] ✅ Completed`
          break
        case 'task.failed':
          line = `[${time}] [${ev.aggregate_id}] ❌ Failed: ${(ev.payload as any)?.error || (ev.payload as any)?.reason || 'unknown'}`
          break
        case 'task.review':
          line = `[${time}] [${ev.aggregate_id}] 👀 Awaiting review`
          break
        case 'approval.requested':
          line = `[${time}] [${ev.aggregate_id}] 🔐 Approval requested: ${(ev.payload as any)?.action_type || ''}`
          break
        case 'approval.approved':
          line = `[${time}] [${ev.aggregate_id}] 👍 Approved by ${(ev.payload as any)?.decided_by || 'operator'}`
          break
        case 'approval.rejected':
          line = `[${time}] [${ev.aggregate_id}] 👎 Rejected: ${(ev.payload as any)?.reason || ''}`
          break
        default:
          line = `[${time}] ${ev.type} • ${ev.aggregate_id}`
      }
      newLines.push(line)
    }

    if (newLines.length > 0) {
      setLines(prev => {
        const combined = [...prev, ...newLines].slice(-150)
        // Deduplicate consecutive duplicates
        return combined.filter((v, i, arr) => i === 0 || v !== arr[i - 1])
      })
    }
  }, [activityEvents, selectedAgent, tasks])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  const copyAll = () => {
    navigator.clipboard.writeText(lines.join('\n'))
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0a0f1a', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 12,
      overflow: 'hidden', fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid rgba(0,229,255,0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,229,255,0.06)',
      }}>
        <Terminal size={14} color="#00e5ff" />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#00e5ff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Terminal • {selectedAgent === 'all' ? 'All Agents' : selectedAgent}
        </span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', marginLeft: 6 }} />
        <span style={{ fontSize: '0.6rem', color: '#34d399' }}>LIVE</span>
        <div style={{ flex: 1 }} />
        <button onClick={copyAll} title="Copy" style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
          <Copy size={12} />
        </button>
        <button onClick={() => setLines([])} title="Clear" style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
          <Trash2 size={12} />
        </button>
      </div>

      <div ref={containerRef} style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        fontSize: '0.7rem', lineHeight: 1.6, color: '#cbd5e1',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {lines.length === 0 ? (
          <div style={{ color: '#475569' }}>
            <div>$ awaiting events…</div>
            <div style={{ marginTop: 8, color: '#334155' }}>Terminal akan menampilkan output real-time dari agent yang sedang bekerja.</div>
            <div style={{ marginTop: 4, color: '#334155' }}>Pilih agent di filter atas untuk melihat output spesifik.</div>
          </div>
        ) : (
          lines.map((l, i) => (
            <div key={i} style={{
              color: l.includes('❌') ? '#fca5a5' : l.includes('✅') ? '#a7f3d0' : l.includes('⚡') ? '#7dd3fc' : l.includes('🔐') ? '#fde68a' : '#cbd5e1',
            }}>
              {l}
            </div>
          ))
        )}
        <div style={{ marginTop: 8, color: '#00e5ff' }}>
          <span style={{ opacity: 0.6 }}>$</span> <span style={{ animation: 'blink 1s step-end infinite' }}>█</span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,50% { opacity: 1 } 51%,100% { opacity: 0 } }
      `}</style>
    </div>
  )
}

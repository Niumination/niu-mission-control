'use client'

/**
 * MiniOrbDock — indikator mini-orb di sisi kiri layar (dock sidebar).
 * PRD §7.1.4: Mini orb selalu terlihat (meskipun AppShell sidebar belum dibuat di M5),
 * pulse sesuai health, dan pointer menunjuk ke posisi task aktif di ReasoningWeb
 * (di mini mode, pointer ini adalah dot/ring berputar di keliling orb kecil).
 */

import { useEffect, useState } from 'react'
import { useOrbState } from '@/lib/client/useOrbState'

export default function MiniOrbDock() {
  const orb = useOrbState()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 80)
    return () => clearInterval(id)
  }, [])

  const state = orb.state
  const intensity = orb.intensity
  const isAlert = state === 'alert'
  const isOffline = state === 'offline'
  const isThinking = state === 'thinking'
  const isSpeaking = state === 'speaking'

  const coreColor = isAlert ? '#ef4444' : isOffline ? '#64748b' : isSpeaking ? '#bff7ff' : '#00e5ff'
  const ringColor = isAlert ? '#ff5e5e' : isOffline ? '#4b5563' : '#f5a623'
  const glowColor = isAlert ? 'rgba(239,68,68,' : isOffline ? 'rgba(100,116,139,' : isSpeaking ? 'rgba(0,229,255,' : 'rgba(0,229,255,'

  // Rotasi dot tracker di keliling orb (kecepatan proporsional dengan intensity)
  const spinSpeed = isOffline ? 0 : isThinking ? 0.8 + intensity * 0.6 : isSpeaking ? 2 : 0.3
  const angle = (tick * spinSpeed * 0.08) % (Math.PI * 2)
  const trackerX = 32 + Math.cos(angle) * 22
  const trackerY = 32 + Math.sin(angle) * 22

  const pulseOpacity = isAlert ? 0.5 + 0.5 * Math.sin(tick * 0.3) : 0.3 + 0.2 * Math.sin(tick * 0.15)

  return (
    <div style={{
      position: 'fixed',
      left: 18,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 95,
      width: 64,
      height: 64,
      cursor: 'pointer',
      opacity: isOffline ? 0.5 : 1,
      transition: 'opacity 0.6s ease',
    }}
    title={`Swarm: ${state.toUpperCase()} (${orb.runningTasks} running, ${orb.queueDepth} queued)`}
    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg width={64} height={64} viewBox="0 0 64 64" style={{ filter: `drop-shadow(0 0 8px ${glowColor}${isAlert ? 0.7 : 0.4}))` }}>
        {/* Outer glow ring */}
        <circle cx={32} cy={32} r={26} fill="none" stroke={ringColor} strokeWidth={1} opacity={pulseOpacity} />
        {/* Middle ring */}
        <circle cx={32} cy={32} r={20} fill="none" stroke={coreColor} strokeWidth={1.2} opacity={0.6} />
        {/* Core dot */}
        <circle cx={32} cy={32} r={isThinking ? 8 + intensity * 1.5 + Math.sin(tick * 0.4) : isSpeaking ? 10 : 7} fill={coreColor} opacity={0.95}
          style={{ filter: `blur(0.5px) drop-shadow(0 0 6px ${coreColor})` }} />
        {/* Inner bright core */}
        <circle cx={32} cy={32} r={isOffline ? 3 : 4} fill="#ffffff" opacity={isOffline ? 0.3 : 0.85} />
        {/* Tracker dot berputar (arah task aktif) */}
        {!isOffline && (
          <circle cx={trackerX} cy={trackerY} r={isAlert ? 3.5 : 2.5} fill={isAlert ? '#fbbf24' : ringColor}
            style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }} />
        )}
        {/* Alert pulse */}
        {isAlert && (
          <circle cx={32} cy={32} r={20 + ((tick * 2) % 20)} fill="none" stroke="#ef4444" strokeWidth={1}
            opacity={Math.max(0, 1 - ((tick * 2) % 20) / 20)} />
        )}
      </svg>
      {/* Count badge — total tasks yang butuh perhatian (running + queued + review) */}
      {(() => {
        const total = orb.runningTasks + orb.queueDepth
        if (total === 0) return null
        return (
          <div style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9,
            background: isAlert ? '#ef4444' : '#00e5ff',
            color: '#04080f',
            fontSize: '0.65rem',
            fontWeight: 700,
            fontFamily: '"JetBrains Mono", monospace',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 10px ${isAlert ? '#ef4444' : '#00e5ff'}`,
          }}>
            {total > 9 ? '9+' : total}
          </div>
        )
      })()}
    </div>
  )
}

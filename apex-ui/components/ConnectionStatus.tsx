'use client'

import { useHealthStore } from '@/lib/client/stores'
import { useEffect, useState } from 'react'

/**
 * ConnectionStatus — indikator dot kecil di top-right yang berdenyut sesuai
 * status koneksi SSE + worker tick.
 */
export default function ConnectionStatus() {
  const connected = useHealthStore(s => s.connected)
  const workerLastTick = useHealthStore(s => s.worker_last_tick)
  const [, setTick] = useState(0)

  // Re-render setiap 3 detik agar "age" tick terupdate
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(id)
  }, [])

  let color = '#f59e0b'
  let label = 'connecting'
  if (connected) {
    const age = workerLastTick ? (Date.now() - new Date(workerLastTick).getTime()) / 1000 : Infinity
    if (age < 10) { color = '#34d399'; label = 'live' }
    else if (age < 60) { color = '#f59e0b'; label = 'slow' }
    else { color = '#ef4444'; label = 'stalled' }
  }

  return (
    <span
      title={`SSE: ${connected ? 'connected' : 'disconnected'} · worker: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 8px ${color}`,
          animation: connected ? 'mc-pulse 2s ease-in-out infinite' : 'none',
        }}
      />
      {label}
    </span>
  )
}

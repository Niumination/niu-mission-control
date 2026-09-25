"use client";

/**
 * OrbStatusBar — the original orb's center cluster (equalizer + core ball + its
 * ring + STANDBY + 3 dots), relocated to the lower part of the page so the
 * particles can own the centre of the ring.
 */
const GOLD = '#f5a623'
const GOLD_BRIGHT = '#ffd080'

function Waveform({ active, cx, cy, width = 200, color = GOLD }) {
  const barCount = 28
  const barW = 3
  const gap = (width - barCount * barW) / (barCount - 1)
  return (
    <g>
      {Array.from({ length: barCount }, (_, i) => {
        const x = cx - width / 2 + i * (barW + gap)
        const baseH = 3 + Math.abs(Math.sin(i * 0.6)) * 5
        const activeH = 8 + Math.abs(Math.sin(i * 0.8)) * 26
        const h = active ? activeH : baseH
        return (
          <rect key={i} x={x} y={cy - h / 2}
            width={barW} height={h}
            rx={1.5} fill={color} opacity={active ? 0.85 : 0.3}
            style={{
              transformOrigin: `${x + barW / 2}px ${cy}px`,
              animation: active ? `sbBar ${0.55 + (i % 5) * 0.16}s ease-in-out ${(i % 7) * 0.07}s infinite alternate` : 'none',
            }} />
        )
      })}
    </g>
  )
}

export default function OrbStatusBar({ state = 'idle' }) {
  const W = 420, H = 130
  const cx = W / 2, cy = 48
  const isActive = state !== 'idle'
  const isAlert = state === 'alert'
  const isOffline = state === 'offline'
  const isThinking = state === 'thinking'
  const isSpeaking = state === 'speaking'
  // Status label + color per state
  const label = isAlert ? 'ATTENTION' : isOffline ? 'OFFLINE' : isSpeaking ? 'SPEAKING' : isThinking ? 'PROCESSING' : 'STANDBY'
  // Color: amber default, merah untuk alert, abu untuk offline
  const ACCENT = isAlert ? '#ef4444' : isOffline ? '#94a3b8' : GOLD
  const ACCENT_BRIGHT = isAlert ? '#fca5a5' : isOffline ? '#cbd5e1' : GOLD_BRIGHT

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 26, display: 'flex',   // site copy: contained in the world section
      justifyContent: 'center', zIndex: 18, pointerEvents: 'none',
    }}>
      <style>{`@keyframes sbBar { from { transform: scaleY(0.35); } to { transform: scaleY(1.15); } }`}</style>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
        <defs>
          <filter id="sbBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* extension lines */}
        <line x1={cx - 150} y1={cy} x2={cx - 28} y2={cy} stroke={ACCENT} strokeWidth="1" opacity={isActive ? 0.5 : 0.18} strokeDasharray="4 3" />
        <line x1={cx + 28} y1={cy} x2={cx + 150} y2={cy} stroke={ACCENT} strokeWidth="1" opacity={isActive ? 0.5 : 0.18} strokeDasharray="4 3" />

        {/* equalizer */}
        <Waveform active={isActive} cx={cx} cy={cy} width={170} color={ACCENT} />

        {/* center ring + ball */}
        <circle cx={cx} cy={cy} r={20} stroke={ACCENT} strokeWidth="1.5" strokeOpacity="0.7" fill="#030200" filter="url(#sbBlur)" className="orb-center-ring" />
        <circle cx={cx} cy={cy} r={6} fill={ACCENT_BRIGHT} opacity="0.95" className="orb-center" style={{ filter: `drop-shadow(0 0 10px ${ACCENT})` }} />

        {/* label */}
        <text x={cx} y={cy + 44} textAnchor="middle" fill={ACCENT} fontSize="13" fontFamily="'Share Tech Mono', monospace" letterSpacing="0.4em" opacity="0.75">{label}</text>

        {/* three dots */}
        {[0, 1, 2].map(i => (
          <circle key={i} cx={cx + (i - 1) * 12} cy={cy + 62} r={2.5} fill={ACCENT} className={`orb-dot-blink blink-${i}`} />
        ))}

        {/* Voice discoverability (UI sweep) — the front page is voice-driven; one whisper-quiet hint on
            standby teaches the commands. Hidden the moment Apex is active. */}
        {!isActive && (
          <text className="sb-hint" x={cx} y={cy + 80} textAnchor="middle" fill={ACCENT} fontSize="9" fontFamily="'Share Tech Mono', monospace"
            letterSpacing="0.14em" opacity="0.32">TAP THE CORE · CLICK AN AGENT · SCROLL FOR THE STORY</text>
        )}
      </svg>
    </div>
  )
}

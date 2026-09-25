'use client'

/**
 * Simple chart components tanpa dependency tambahan (no recharts)
 * - BarChart
 * - StackedBar
 * - HorizontalBar
 * - PieChart (SVG)
 * - LineChart (SVG)
 * - Histogram
 */

interface BarData { label: string; value: number; color?: string; sub?: number }
interface StackedData { label: string; stacks: { key: string; value: number; color: string }[] }

export function BarChart({ data, height = 120, color = '#00e5ff' }: { data: BarData[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>{d.value > 0 ? d.value : ''}</span>
            <div style={{
              width: '100%', maxWidth: 36,
              height: `${(d.value / max) * (height - 30)}px`, minHeight: d.value > 0 ? 4 : 1,
              background: `linear-gradient(180deg, ${d.color || color}, ${(d.color || color)}88)`,
              borderRadius: 4, transition: 'height 0.3s ease',
            }} />
            {d.sub !== undefined && d.sub > 0 && (
              <div style={{
                width: '100%', maxWidth: 36, height: `${(d.sub / max) * (height - 30) * 0.6}px`, minHeight: 2,
                background: '#ef4444aa', borderRadius: 2, marginTop: 2,
              }} />
            )}
          </div>
          <span style={{ fontSize: '0.55rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function HorizontalBar({ data, height = 24 }: { data: { label: string; value: number; max?: number; color: string }[]; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.max ?? d.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 90, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
          <div style={{ flex: 1, height, background: 'rgba(240,237,232,0.06)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%', width: `${(d.value / max) * 100}%`,
              background: `linear-gradient(90deg, ${d.color}, ${d.color}cc)`,
              borderRadius: 6, transition: 'width 0.5s ease',
              boxShadow: `0 0 8px ${d.color}40`,
            }} />
          </div>
          <span style={{ width: 44, fontSize: '0.75rem', fontWeight: 700, color: d.color }}>{d.value}%</span>
        </div>
      ))}
    </div>
  )
}

export function PieChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(240,237,232,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.7rem' }}>No data</div>
  }
  let acc = 0
  const slices = data.map(d => {
    const start = acc
    const angle = (d.value / total) * 360
    acc += angle
    return { ...d, start, angle }
  })

  const toRad = (deg: number) => (deg - 90) * Math.PI / 180
  const polar = (cx: number, cy: number, r: number, angle: number) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  })

  const cx = size / 2, cy = size / 2, r = size / 2 - 4

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => {
          const start = polar(cx, cy, r, s.start)
          const end = polar(cx, cy, r, s.start + s.angle)
          const large = s.angle > 180 ? 1 : 0
          const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`
          return <path key={i} d={d} fill={s.color} stroke="#04080f" strokeWidth={1} />
        })}
        <circle cx={cx} cy={cy} r={r * 0.45} fill="#04080f" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#94a3b8" fontSize="10" fontFamily="monospace">{total.toFixed(2)}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, display: 'inline-block' }} />
            <span style={{ color: '#cbd5e1', minWidth: 80 }}>{d.label}</span>
            <span style={{ color: '#94a3b8' }}>{((d.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LineChart({ data, height = 100, color = '#00e5ff' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  if (data.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.7rem' }}>No data</div>
  const max = Math.max(1, ...data.map(d => d.value))
  const min = Math.min(0, ...data.map(d => d.value))
  const range = max - min || 1
  const w = 100
  const step = w / Math.max(1, data.length - 1)

  const points = data.map((d, i) => {
    const x = i * step
    const y = height - ((d.value - min) / range) * (height - 20) - 10
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `${points} ${w},${height} 0,${height}`

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <polygon points={areaPoints} fill={`${color}20`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={0.8} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => {
          const x = i * step
          const y = height - ((d.value - min) / range) * (height - 20) - 10
          return <circle key={i} cx={x} cy={y} r={1.2} fill={color} />
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.55rem', color: '#475569' }}>
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}

export function StackedBarChart({ data, height = 120 }: { data: StackedData[]; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.stacks.reduce((s, x) => s + x.value, 0)))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, padding: '0 4px' }}>
      {data.map((d, i) => {
        const total = d.stacks.reduce((s, x) => s + x.value, 0)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>{total > 0 ? `$${total.toFixed(2)}` : ''}</span>
            <div style={{ width: '100%', maxWidth: 32, height: `${(total / max) * (height - 30)}px`, minHeight: total > 0 ? 6 : 1, display: 'flex', flexDirection: 'column-reverse', borderRadius: 4, overflow: 'hidden' }}>
              {d.stacks.map((s, j) => (
                <div key={j} title={`${s.key}: $${s.value.toFixed(4)}`} style={{
                  height: `${(s.value / total) * 100}%`, minHeight: s.value > 0 ? 2 : 0,
                  background: s.color,
                }} />
              ))}
            </div>
            <span style={{ fontSize: '0.55rem', color: '#64748b', whiteSpace: 'nowrap' }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

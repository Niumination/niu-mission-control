'use client'

/**
 * SkeletonPage — placeholder reusable untuk halaman yang belum di-build di milestone ini.
 * Dipakai oleh Missions, Agents, Live Ops, Analytics, Audit, Settings.
 */

interface Props {
  icon: React.ComponentType<{ size?: number; color?: string }>
  title: string
  tag: string
  description: string
  bullets: string[]
  accent: string
}

export default function SkeletonPage({ icon: Icon, title, tag, description, bullets, accent }: Props) {
  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40, fontFamily: '"JetBrains Mono", monospace',
      background: 'radial-gradient(ellipse 80% 70% at 50% 30%, rgba(15,30,50,0.6), #04080f)',
    }}>
      <div style={{
        maxWidth: 520, width: '100%',
        background: 'rgba(15,23,42,0.7)',
        border: `1px solid ${accent}30`,
        borderRadius: 16, padding: 36,
        backdropFilter: 'blur(16px)',
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            background: `${accent}18`,
            border: `1px solid ${accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 20px ${accent}30`,
          }}>
            <Icon size={26} color={accent} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f0ede8', letterSpacing: '0.02em' }}>{title}</h1>
              <span style={{
                fontSize: '0.6rem', padding: '2px 8px', borderRadius: 4,
                background: `${accent}22`, color: accent, border: `1px solid ${accent}40`,
                letterSpacing: '0.1em', fontWeight: 700,
              }}>{tag}</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5 }}>{description}</p>
          </div>
        </div>
        <div style={{
          padding: '14px 16px', marginBottom: 20,
          borderRadius: 10,
          background: 'rgba(4,8,15,0.5)',
          border: '1px dashed rgba(240,237,232,0.1)',
        }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Akan hadir di milestone ini:</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.8 }}>
            {bullets.map((b, i) => (
              <li key={i} style={{ listStyleType: '"▸ "', paddingLeft: 6 }}>{b}</li>
            ))}
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            flex: 1, height: 2, borderRadius: 1,
            background: `linear-gradient(90deg, ${accent}, transparent)`,
            opacity: 0.4,
          }} />
          <span style={{ fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.2em' }}>COMING SOON</span>
        </div>
      </div>
    </div>
  )
}

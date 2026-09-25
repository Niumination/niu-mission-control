'use client'

/**
 * ApprovalBanner — banner kuning di atas orb saat ada task review/approval.
 * Jumlah review task diambil dari Zustand store (SSE realtime).
 */

import { useTasksStore } from '@/lib/client/stores'

export default function ApprovalBanner() {
  const reviewCount = useTasksStore(s => Object.values(s.tasks).filter(t => t.status === 'review').length)
  if (reviewCount === 0) return null

  return (
    <div style={{
      position: 'absolute',
      top: '22%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      padding: '8px 18px',
      background: 'linear-gradient(90deg, rgba(245,166,35,0.25), rgba(245,166,35,0.1))',
      border: '1px solid rgba(245,166,35,0.6)',
      borderRadius: 8,
      color: '#f5a623',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      boxShadow: '0 0 24px rgba(245,166,35,0.35)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      backdropFilter: 'blur(8px)',
      animation: 'banner-pulse 2s ease-in-out infinite',
      pointerEvents: 'auto',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: '#f5a623', boxShadow: '0 0 10px #f5a623',
      }} />
      <span>{reviewCount} approval{reviewCount > 1 ? 's' : ''} await{reviewCount === 1 ? 's' : ''} review</span>
      <a href="/ops#approvals" style={{
        color: '#04080f', background: '#f5a623', padding: '3px 10px',
        borderRadius: 4, textDecoration: 'none', fontSize: '0.65rem',
        fontWeight: 700,
      }}>Review →</a>
      <style>{`
        @keyframes banner-pulse {
          0%, 100% { box-shadow: 0 0 24px rgba(245,166,35,0.35); }
          50%      { box-shadow: 0 0 40px rgba(245,166,35,0.7); }
        }
      `}</style>
    </div>
  )
}

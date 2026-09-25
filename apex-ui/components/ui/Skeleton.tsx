'use client'

/**
 * Skeleton — loading placeholder dengan shimmer
 */

import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
  count?: number
  gap?: number
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style, count = 1, gap = 8 }: SkeletonProps) {
  const items = Array.from({ length: count })
  return (
    <>
      {items.map((_, i) => (
        <div
          key={i}
          style={{
            width, height, borderRadius,
            background: 'linear-gradient(90deg, rgba(240,237,232,0.06) 25%, rgba(240,237,232,0.12) 50%, rgba(240,237,232,0.06) 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
            marginBottom: i < items.length - 1 ? gap : 0,
            ...style,
          }}
        />
      ))}
      <style>{`
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </>
  )
}

export function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(240,237,232,0.06)', borderRadius: 12,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Skeleton width={44} height={44} borderRadius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
      <Skeleton count={3} gap={8} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} height={16} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ height = 120 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton width="30%" height={14} />
      <Skeleton height={height} borderRadius={12} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton width={60} height={12} />
        <Skeleton width={60} height={12} />
        <Skeleton width={60} height={12} />
      </div>
    </div>
  )
}

export default Skeleton

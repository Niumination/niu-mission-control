'use client'

/**
 * Toast system — ringan, tanpa dependensi eksternal.
 * API: toast.success/error/info(message, {duration})
 * Dipanggil dari mana saja; mount <ToastViewport /> sekali di root.
 */

import { create } from 'zustand'
import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info' | 'warning'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  duration: number
  createdAt: number
}

interface ToastStore {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string, opts?: { duration?: number }) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (kind, message, opts) => {
    const id = nextId++
    const duration = opts?.duration ?? 3500
    const item: ToastItem = { id, kind, message, duration, createdAt: Date.now() }
    set(s => ({ toasts: [...s.toasts, item] }))
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration)
    }
    return id
  },
  dismiss: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export const toast = {
  success: (m: string, o?: { duration?: number }) => useToastStore.getState().push('success', m, o),
  error:   (m: string, o?: { duration?: number }) => useToastStore.getState().push('error', m, o),
  info:    (m: string, o?: { duration?: number }) => useToastStore.getState().push('info', m, o),
  warning: (m: string, o?: { duration?: number }) => useToastStore.getState().push('warning', m, o),
}

const COLOR: Record<ToastKind, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52,211,153,0.5)', text: '#34d399', icon: '#34d399' },
  error:   { bg: 'rgba(239, 68, 68, 0.14)',  border: 'rgba(239,68,68,0.5)',  text: '#fca5a5', icon: '#ef4444' },
  warning: { bg: 'rgba(245,166,35,0.14)',    border: 'rgba(245,166,35,0.5)',  text: '#fde68a', icon: '#f5a623' },
  info:    { bg: 'rgba(0,229,255,0.12)',     border: 'rgba(0,229,255,0.5)',   text: '#a5f3fc', icon: '#00e5ff' },
}

const IconFor: Record<ToastKind, React.ComponentType<{ size?: number; color?: string }>> = {
  success: CheckCircle,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
}

export function ToastViewport() {
  const toasts = useToastStore(s => s.toasts)
  const dismiss = useToastStore(s => s.dismiss)
  // Force re-render untuk animasi (mount)
  const [mounted, setMounted] = useState<Set<number>>(new Set())
  useEffect(() => {
    // RAF agar animasi masuk terpicu
    requestAnimationFrame(() => {
      setMounted(new Set(toasts.map(t => t.id)))
    })
  }, [toasts])

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, width: 340,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const c = COLOR[t.kind]
        const I = IconFor[t.kind]
        const isIn = mounted.has(t.id)
        return (
          <div key={t.id}
            style={{
              pointerEvents: 'auto',
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              backdropFilter: 'blur(16px)',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.8rem',
              color: c.text,
              boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)`,
              transform: isIn ? 'translateX(0)' : 'translateX(120%)',
              opacity: isIn ? 1 : 0,
              transition: 'transform 0.3s cubic-bezier(.2,.9,.3,1.2), opacity 0.3s',
            }}
          >
            <I size={18} color={c.icon} />
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: c.text, opacity: 0.6, padding: 2,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.6' }}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

'use client'

/**
 * ErrorBoundary — per halaman dengan tombol retry
 * Usage: <ErrorBoundary><YourPage /></ErrorBoundary>
 */

import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error, info)
    // Also log to system_logs via API if possible
    try {
      fetch('/api/mc/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'error', message: `UI Error: ${error.message}`, source: 'ErrorBoundary', metadata: { stack: error.stack?.slice(0, 1000) } }),
      }).catch(() => {})
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 40,
          background: '#04080f', color: '#f0ede8',
          fontFamily: '"JetBrains Mono", monospace', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <AlertTriangle size={28} color="#ef4444" />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 700, color: '#f0ede8' }}>Something went wrong</h2>
          <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#94a3b8', maxWidth: 480 }}>
            {this.state.error?.message || 'An unexpected error occurred in this page.'}
          </p>
          <pre style={{
            margin: '12px 0', padding: '10px 12px', borderRadius: 8,
            background: 'rgba(4,8,15,0.8)', border: '1px solid rgba(239,68,68,0.2)',
            fontSize: '0.65rem', color: '#fca5a5', maxWidth: 600, overflow: 'auto', textAlign: 'left',
            maxHeight: 120,
          }}>{this.state.error?.stack?.slice(0, 800) || 'No stack trace'}</pre>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '9px 16px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(90deg, #00e5ff, #a855f7)', color: '#04080f',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <RefreshCw size={14} /> Retry
            </button>
            <button onClick={() => window.location.href = '/'}
              style={{
                padding: '9px 16px', borderRadius: 8,
                background: 'rgba(240,237,232,0.06)', border: '1px solid rgba(240,237,232,0.12)',
                color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <Home size={14} /> Go Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary

// Hook version for functional components — useErrorBoundary
export function useErrorHandler() {
  return (error: Error) => {
    console.error('[useErrorHandler]', error)
    throw error
  }
}

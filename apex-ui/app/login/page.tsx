'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const from = params.get('from') || '/'

  // Redirect if already logged in
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.authenticated) router.replace(from)
        if (d.setupRequired) router.replace('/setup')
      })
  }, [from, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || data.message || 'Login gagal')
      return
    }
    router.replace(from)
    router.refresh()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #122c43 0%, #0a0f1a 70%)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 'min(380px, 90vw)',
          padding: '40px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: 16,
          boxShadow: '0 0 40px rgba(0, 229, 255, 0.15), 0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ffcf6b 0%, #00e5ff 50%, transparent 80%)',
              margin: '0 auto 16px',
              boxShadow: '0 0 24px #00e5ff',
            }}
          />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#e8eef5', letterSpacing: '0.05em' }}>
            Niu-Mission Control
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#546a7d', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Operator Authentication
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'rgba(8, 14, 26, 0.6)',
              border: `1px solid ${error ? '#ef4444' : 'rgba(240,237,232,0.15)'}`,
              borderRadius: 10,
              color: '#e8eef5',
              fontFamily: 'inherit',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { if (!error) e.currentTarget.style.borderColor = '#00e5ff' }}
            onBlur={e => { if (!error) e.currentTarget.style.borderColor = 'rgba(240,237,232,0.15)' }}
          />
          {error && (
            <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: '100%',
            padding: '12px',
            background: loading || !password ? 'rgba(0, 229, 255, 0.3)' : 'linear-gradient(90deg, #00e5ff, #f5a623)',
            border: 'none',
            borderRadius: 10,
            color: '#0a0f1a',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'opacity 0.2s',
            opacity: loading || !password ? 0.6 : 1,
          }}
        >
          {loading ? 'Authenticating...' : 'Enter Mission Control'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0f1a',
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: 13,
      }}>
        Loading...
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

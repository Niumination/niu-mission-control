'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<null | { apiKey: string; passwordHash: string }>(null)

  useEffect(() => {
    fetch('/api/auth/setup')
      .then(r => r.json())
      .then(d => {
        if (!d.setupRequired && d.allowReset !== true) router.replace('/login')
      })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password minimal 6 karakter')
      return
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak cocok')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Setup gagal')
      return
    }
    setResult(data.credentials)
  }

  if (result) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #122c43 0%, #0a0f1a 70%)',
          padding: 20,
        }}
      >
        <div
          style={{
            width: 'min(520px, 100%)',
            padding: 32,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid #34d399',
            borderRadius: 16,
            boxShadow: '0 0 40px rgba(52, 211, 153, 0.2)',
          }}
        >
          <h2 style={{ color: '#34d399', margin: '0 0 8px', fontSize: 18 }}>✅ Setup Berhasil</h2>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 24px' }}>
            Simpan kredensial berikut di tempat aman. API key tidak bisa dilihat lagi setelah halaman ditutup.
            File <code style={{ color: '#f5a623', fontFamily: 'monospace' }}>.env.local</code> sudah dibuat otomatis di repo root.
          </p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#546a7d', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>API Key</div>
            <div style={{
              padding: 12,
              background: 'rgba(8, 14, 26, 0.8)',
              border: '1px solid rgba(0,229,255,0.3)',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#00e5ff',
              wordBreak: 'break-all',
            }}>{result.apiKey}</div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: '#546a7d', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Password Hash</div>
            <div style={{
              padding: 12,
              background: 'rgba(8, 14, 26, 0.8)',
              border: '1px solid rgba(240,237,232,0.15)',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 10,
              color: '#94a3b8',
              wordBreak: 'break-all',
            }}>{result.passwordHash.slice(0, 100)}...</div>
          </div>

          <button
            onClick={() => { window.location.href = '/' }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(90deg, #34d399, #00e5ff)',
              border: 'none',
              borderRadius: 10,
              color: '#0a0f1a',
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Masuk Mission Control
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #122c43 0%, #0a0f1a 70%)',
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 'min(420px, 100%)',
          padding: 32,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: 16,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'radial-gradient(circle, #ffcf6b, #00e5ff, transparent)', margin: '0 auto 16px', boxShadow: '0 0 24px #00e5ff' }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#e8eef5' }}>Setup Niu-Mission Control</h1>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Buat password operator untuk pertama kali.
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus
            style={{ width: '100%', padding: '12px 14px', background: 'rgba(8,14,26,0.6)', border: '1px solid rgba(240,237,232,0.15)', borderRadius: 10, color: '#e8eef5', fontSize: 14, outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Konfirmasi Password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', background: 'rgba(8,14,26,0.6)', border: '1px solid rgba(240,237,232,0.15)', borderRadius: 10, color: '#e8eef5', fontSize: 14, outline: 'none' }} />
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 14 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: '100%', padding: '12px',
            background: loading || !password ? 'rgba(0,229,255,0.3)' : 'linear-gradient(90deg,#00e5ff,#f5a623)',
            border: 'none', borderRadius: 10, color: '#0a0f1a', fontWeight: 600, fontSize: 13,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: loading ? 'wait' : 'pointer', opacity: loading || !password ? 0.6 : 1,
          }}
        >
          {loading ? 'Membuat kredensial...' : 'Initialize Control Plane'}
        </button>
      </form>
    </div>
  )
}

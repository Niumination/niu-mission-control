'use client'

/**
 * /settings — Configuration tabs: General, Agents, Adapters, Notifications, Security, Budget, Backup, About
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings, Bot, Cpu, Bell, Shield, DollarSign, HardDrive, Info, Save, RefreshCw, Download, Trash2, Plus, Key, Globe, Clock } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

type Tab = 'general' | 'agents' | 'adapters' | 'notifications' | 'security' | 'budget' | 'backup' | 'about'

const TABS: { id: Tab; label: string; icon: any; accent: string }[] = [
  { id: 'general', label: 'General', icon: Globe, accent: '#00e5ff' },
  { id: 'agents', label: 'Agents', icon: Bot, accent: '#a855f7' },
  { id: 'adapters', label: 'Adapters', icon: Cpu, accent: '#f5a623' },
  { id: 'notifications', label: 'Notifications', icon: Bell, accent: '#34d399' },
  { id: 'security', label: 'Security', icon: Shield, accent: '#ef4444' },
  { id: 'budget', label: 'Budget', icon: DollarSign, accent: '#f5a623' },
  { id: 'backup', label: 'Backup', icon: HardDrive, accent: '#94a3b8' },
  { id: 'about', label: 'About', icon: Info, accent: '#64748b' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general')
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [raw, setRaw] = useState<any[]>([])
  const [backups, setBackups] = useState<any[]>([])
  const [env, setEnv] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agents, setAgents] = useState<any[]>([])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [sRes, aRes] = await Promise.all([
        fetch('/api/mc/settings'),
        fetch('/api/mc/agents'),
      ])
      const sData = await sRes.json()
      const aData = await aRes.json()
      if (sData.settings) {
        setSettings(sData.settings)
        setRaw(sData.raw || [])
        setBackups(sData.backups || [])
        setEnv(sData.env || null)
      }
      if (aData.agents) setAgents(aData.agents)
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const saveSetting = async (key: string, value: any) => {
    setSaving(true)
    try {
      const res = await fetch('/api/mc/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: [{ key, value }] }),
      })
      if (res.ok) {
        toast.success(`Saved ${key}`)
        setSettings(prev => ({ ...prev, [key]: value }))
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error || 'Failed to save')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      display: 'flex',
      background: '#04080f',
      color: '#f0ede8',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {/* Sidebar tabs */}
      <div style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid rgba(240,237,232,0.07)',
        padding: '20px 12px',
        background: 'rgba(4,8,15,0.4)',
      }}>
        <h2 style={{ margin: '0 0 16px 8px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={14} /> Settings
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TABS.map(t => {
            const I = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8,
                  background: active ? `${t.accent}15` : 'transparent',
                  border: `1px solid ${active ? `${t.accent}40` : 'transparent'}`,
                  color: active ? t.accent : '#94a3b8',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: active ? 700 : 400,
                  textAlign: 'left', transition: 'all 0.15s',
                }}>
                <I size={14} /> {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 24, padding: '12px', background: 'rgba(240,237,232,0.03)', borderRadius: 10, border: '1px solid rgba(240,237,232,0.06)' }}>
          <div style={{ fontSize: '0.6rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Instance</div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{env?.version || 'v4.0.0'}</div>
          <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 4 }}>{env?.agents_count || 0} agents • {env?.db_size_bytes ? `${(env.db_size_bytes / 1024 / 1024).toFixed(2)} MB` : '—'} DB</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ color: '#64748b' }}>Loading settings…</div>
        ) : (
          <>
            {tab === 'general' && <GeneralTab settings={settings} onSave={saveSetting} saving={saving} env={env} />}
            {tab === 'agents' && <AgentsTab agents={agents} onRefresh={fetchAll} />}
            {tab === 'adapters' && <AdaptersTab settings={settings} onSave={saveSetting} saving={saving} />}
            {tab === 'notifications' && <NotificationsTab settings={settings} onSave={saveSetting} saving={saving} />}
            {tab === 'security' && <SecurityTab settings={settings} onSave={saveSetting} saving={saving} />}
            {tab === 'budget' && <BudgetTab settings={settings} onSave={saveSetting} saving={saving} />}
            {tab === 'backup' && <BackupTab backups={backups} env={env} onRefresh={fetchAll} />}
            {tab === 'about' && <AboutTab env={env} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── Tab components ──────────────────────────────────────────────

function GeneralTab({ settings, onSave, saving, env }: any) {
  const [instanceName, setInstanceName] = useState(settings.instance_name || 'Niumination Mission Control')
  const [timezone, setTimezone] = useState(settings.timezone || 'Asia/Jakarta')
  const [theme, setTheme] = useState(settings.theme || 'dark')

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>General</h3>
      <Field label="Instance Name">
        <input value={instanceName} onChange={e => setInstanceName(e.target.value)} style={inputStyle} />
        <button onClick={() => onSave('instance_name', instanceName)} disabled={saving} style={saveBtnStyle}>Save</button>
      </Field>
      <Field label="Timezone">
        <select value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle}>
          <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
          <option value="Asia/Singapore">Asia/Singapore</option>
          <option value="UTC">UTC</option>
          <option value="America/New_York">America/New_York</option>
        </select>
        <button onClick={() => onSave('timezone', timezone)} disabled={saving} style={saveBtnStyle}>Save</button>
      </Field>
      <Field label="Theme">
        <div style={{ display: 'flex', gap: 8 }}>
          {['dark', 'classic', 'experimental'].map(t => (
            <button key={t} onClick={() => setTheme(t)} style={{
              padding: '8px 14px', borderRadius: 8,
              background: theme === t ? 'rgba(0,229,255,0.15)' : 'rgba(240,237,232,0.04)',
              border: `1px solid ${theme === t ? 'rgba(0,229,255,0.4)' : 'rgba(240,237,232,0.1)'}`,
              color: theme === t ? '#00e5ff' : '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
            }}>{t}</button>
          ))}
        </div>
        <button onClick={() => onSave('theme', theme)} disabled={saving} style={saveBtnStyle}>Save Theme</button>
      </Field>

      <Section title="Environment">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '0.72rem' }}>
          <span style={{ color: '#64748b' }}>Node Env</span><span style={{ color: '#cbd5e1' }}>{env?.node_env}</span>
          <span style={{ color: '#64748b' }}>DB Path</span><span style={{ color: '#cbd5e1', wordBreak: 'break-all' }}>{env?.db_path}</span>
          <span style={{ color: '#64748b' }}>DB Size</span><span style={{ color: '#cbd5e1' }}>{env?.db_size_bytes ? `${(env.db_size_bytes / 1024).toFixed(1)} KB` : '—'}</span>
          <span style={{ color: '#64748b' }}>Version</span><span style={{ color: '#cbd5e1' }}>{env?.version}</span>
        </div>
      </Section>
    </div>
  )
}

function AgentsTab({ agents, onRefresh }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, flex: 1 }}>Agents ({agents.length})</h3>
        <button onClick={onRefresh} style={{ ...saveBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={12} /> Refresh</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {agents.map((a: any) => (
          <div key={a.id} style={{ padding: 14, background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={16} color="#04080f" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0ede8' }}>{a.name}</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{a.id} • {a.status}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Model: {a.model_default || '—'} • Adapter: {a.adapter}</div>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 4 }}>Tasks: {a.total_tasks ?? 0} • Success: {a.success_rate ?? 0}% • Cost: ${(a.total_cost_usd ?? 0).toFixed(4)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.68rem', color: '#475569' }}>Edit detail agent di halaman <Link href="/agents" style={{ color: '#a855f7' }}>/agents</Link> → klik card → Config tab</div>
    </div>
  )
}

function AdaptersTab({ settings, onSave, saving }: any) {
  const [hermesPath, setHermesPath] = useState(settings.hermes_path || '/usr/local/bin/hermes')
  const [mockEnabled, setMockEnabled] = useState(settings.mock_adapter_enabled ?? true)

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Adapters</h3>
      <Field label="Hermes CLI Path">
        <input value={hermesPath} onChange={e => setHermesPath(e.target.value)} placeholder="/usr/local/bin/hermes" style={inputStyle} />
        <button onClick={() => onSave('hermes_path', hermesPath)} disabled={saving} style={saveBtnStyle}>Save</button>
      </Field>
      <Field label="Mock Adapter (for dev)">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem', color: '#94a3b8' }}>
          <input type="checkbox" checked={mockEnabled} onChange={e => setMockEnabled(e.target.checked)} style={{ accentColor: '#00e5ff' }} />
          Enable mock adapter (simulasi tanpa Hermes CLI)
        </label>
        <button onClick={() => onSave('mock_adapter_enabled', mockEnabled)} disabled={saving} style={saveBtnStyle}>Save</button>
      </Field>
      <Section title="Available Adapters">
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.6 }}>
          <div>• <b style={{ color: '#00e5ff' }}>mock</b> — Simulasi task dengan delay random, success/failure rate, cocok untuk dev tanpa Hermes</div>
          <div>• <b style={{ color: '#f5a623' }}>hermes</b> — Memanggil Hermes CLI via execFile, parsing stdout untuk token usage</div>
          <div style={{ marginTop: 8, color: '#64748b' }}>Tambah adapter baru: buat file di `lib/server/adapters/` yang implement interface `AgentAdapter`</div>
        </div>
      </Section>
    </div>
  )
}

function NotificationsTab({ settings, onSave, saving }: any) {
  const [telegramChatId, setTelegramChatId] = useState(settings.telegram_chat_id || '')
  const [alertOnError, setAlertOnError] = useState(settings.alert_on_error ?? true)
  const [alertOnApproval, setAlertOnApproval] = useState(settings.alert_on_approval ?? true)

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Notifications</h3>
      <Field label="Telegram Chat ID">
        <input value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} placeholder="e.g. -1001234567890 or @channel" style={inputStyle} />
        <button onClick={() => onSave('telegram_chat_id', telegramChatId)} disabled={saving} style={saveBtnStyle}>Save</button>
      </Field>
      <Field label="Alert Rules">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer' }}>
          <input type="checkbox" checked={alertOnError} onChange={e => setAlertOnError(e.target.checked)} style={{ accentColor: '#ef4444' }} />
          Alert on agent error streak (3x)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer', marginTop: 8 }}>
          <input type="checkbox" checked={alertOnApproval} onChange={e => setAlertOnApproval(e.target.checked)} style={{ accentColor: '#f5a623' }} />
          Alert on approval needed
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => onSave('alert_on_error', alertOnError)} disabled={saving} style={saveBtnStyle}>Save Error Alert</button>
          <button onClick={() => onSave('alert_on_approval', alertOnApproval)} disabled={saving} style={saveBtnStyle}>Save Approval Alert</button>
        </div>
      </Field>
    </div>
  )
}

function SecurityTab({ settings, onSave, saving }: any) {
  const [sessionTimeout, setSessionTimeout] = useState(settings.session_timeout_min || 60)
  const [apiKey, setApiKey] = useState('••••••••••••••••')

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Security</h3>
      <Field label="Session Timeout (minutes)">
        <input type="number" value={sessionTimeout} onChange={e => setSessionTimeout(Number(e.target.value))} min={5} max={1440} style={inputStyle} />
        <button onClick={() => onSave('session_timeout_min', sessionTimeout)} disabled={saving} style={saveBtnStyle}>Save</button>
      </Field>
      <Field label="API Keys">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Key size={14} color="#f5a623" />
          <input value={apiKey} readOnly style={{ ...inputStyle, flex: 1, opacity: 0.6 }} />
          <button style={{ ...saveBtnStyle, background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>Revoke</button>
        </div>
        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 6 }}>API key management via env `MC_API_KEY` dan `data/` — untuk v4.0 cukup 1 key. RBAC akan datang di v5.</div>
      </Field>
      <Section title="Auth">
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.6 }}>
          <div>• Web UI: session cookie httpOnly, sameSite=strict, password dari env `MC_PASSWORD`</div>
          <div>• API: header `X-API-Key` atau session cookie</div>
          <div>• Middleware melindungi semua `/api/mc/*`</div>
          <div>• Semua input divalidasi Zod, tidak ada `any` tanpa alasan</div>
        </div>
      </Section>
    </div>
  )
}

function BudgetTab({ settings, onSave, saving }: any) {
  const [dailyBudget, setDailyBudget] = useState(settings.daily_budget_usd || 10)
  const [monthlyBudget, setMonthlyBudget] = useState(settings.monthly_budget_usd || 100)

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Budget</h3>
      <Field label="Daily Budget USD">
        <input type="number" value={dailyBudget} onChange={e => setDailyBudget(Number(e.target.value))} min={1} step={1} style={inputStyle} />
        <button onClick={() => onSave('daily_budget_usd', dailyBudget)} disabled={saving} style={saveBtnStyle}>Save</button>
      </Field>
      <Field label="Monthly Budget USD">
        <input type="number" value={monthlyBudget} onChange={e => setMonthlyBudget(Number(e.target.value))} min={10} step={10} style={inputStyle} />
        <button onClick={() => onSave('monthly_budget_usd', monthlyBudget)} disabled={saving} style={saveBtnStyle}>Save</button>
      </Field>
      <Section title="Budget Enforcement">
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.6 }}>
          <div>• Jika daily budget terlampaui, alert akan muncul di bell + Telegram</div>
          <div>• Hard kill-switch (stop dispatcher) akan datang di M11 polish — untuk sekarang hanya alert</div>
          <div>• Cost tracking dari adapter Hermes (token usage × rate model)</div>
        </div>
      </Section>
    </div>
  )
}

function BackupTab({ backups, env, onRefresh }: any) {
  const [backingUp, setBackingUp] = useState(false)

  const triggerBackup = async () => {
    setBackingUp(true)
    try {
      const res = await fetch('/api/mc/backups', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Backup created: ${data.backup.file.split('/').pop()}`)
        onRefresh()
      } else {
        toast.error(data.error || 'Backup failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setBackingUp(false)
    }
  }

  const downloadBackup = async (name: string) => {
    try {
      const res = await fetch(`/api/mc/backups/${encodeURIComponent(name)}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j.error || 'Download failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${name}`)
    } catch {
      toast.error('Download error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, flex: 1 }}>Backup ({backups.length})</h3>
        <button onClick={triggerBackup} disabled={backingUp}
          style={{ ...saveBtnStyle, display: 'flex', alignItems: 'center', gap: 6, opacity: backingUp ? 0.6 : 1 }}>
          <HardDrive size={12} /> {backingUp ? 'Backing up…' : 'Manual Backup'}
        </button>
        <button onClick={onRefresh} style={{ ...saveBtnStyle, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(240,237,232,0.06)', color: '#94a3b8' }}><RefreshCw size={12} /> Refresh</button>
      </div>

      <div style={{ padding: 14, background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: 10 }}>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 8 }}>DB Path: {env?.db_path}</div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>DB Size: {env?.db_size_bytes ? `${(env.db_size_bytes / 1024 / 1024).toFixed(2)} MB` : '—'} • Backups dir: `data/backups/`</div>
        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 8 }}>Backup otomatis harian jam 3 pagi via scheduler (cek setiap jam, retention 30 hari, VACUUM INTO). Manual trigger tersedia di atas. CLI: <code style={{ background: 'rgba(240,237,232,0.08)', padding: '2px 6px', borderRadius: 4 }}>npx tsx scripts/backup.ts</code></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {backups.length === 0 && <div style={{ color: '#64748b', fontSize: '0.8rem', padding: 20, textAlign: 'center' }}>No backups yet — klik Manual Backup atau tunggu scheduler 3 AM</div>}
        {backups.map((b: any) => (
          <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.07)', borderRadius: 10 }}>
            <HardDrive size={16} color="#94a3b8" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', color: '#f0ede8' }}>{b.name}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{(b.size / 1024).toFixed(1)} KB • {new Date(b.created_at).toLocaleString()}</div>
            </div>
            <button onClick={() => downloadBackup(b.name)}
              style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(240,237,232,0.04)', border: '1px solid rgba(240,237,232,0.1)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', fontSize: '0.7rem' }}>
              <Download size={12} /> Download
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AboutTab({ env }: any) {
  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>About</h3>
      <div style={{ padding: 16, background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(168,85,247,0.08))', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 12 }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f0ede8' }}>Niumination Mission Control</div>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>v4.0.0 &ldquo;Aether&rdquo; — Personal AI OS Dashboard</div>
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 8 }}>Based on APEX-UI (MIT) • Built with Next.js 15 + React 19 + SQLite + Zustand + dnd-kit</div>
      </div>

      <Section title="Credits">
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.6 }}>
          <div>• Orb & Reasoning Web: hand-written SVG + R3F Three.js</div>
          <div>• Control Plane: inspired by Builderz/mission-control</div>
          <div>• Design: Linear.app density + cyberpunk elegant</div>
          <div>• Author: Afrizal Munthe + Hermes Chief swarm</div>
        </div>
      </Section>

      <Section title="Environment">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '0.72rem' }}>
          <span style={{ color: '#64748b' }}>Version</span><span style={{ color: '#cbd5e1' }}>{env?.version || '4.0.0'}</span>
          <span style={{ color: '#64748b' }}>Node Env</span><span style={{ color: '#cbd5e1' }}>{env?.node_env}</span>
          <span style={{ color: '#64748b' }}>Agents</span><span style={{ color: '#cbd5e1' }}>{env?.agents_count}</span>
          <span style={{ color: '#64748b' }}>DB Size</span><span style={{ color: '#cbd5e1' }}>{env?.db_size_bytes ? `${(env.db_size_bytes / 1024 / 1024).toFixed(2)} MB` : '—'}</span>
          <span style={{ color: '#64748b' }}>Backups</span><span style={{ color: '#cbd5e1' }}>{env?.backup_count}</span>
        </div>
      </Section>

      <Section title="Docs">
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.8 }}>
          <div>• <a href="https://github.com/builderz-labs/mission-control" target="_blank" style={{ color: '#00e5ff' }}>Builderz/mission-control</a> — referensi arsitektur</div>
          <div>• <code style={{ background: 'rgba(240,237,232,0.06)', padding: '2px 6px', borderRadius: 4 }}>docs/PRD.md</code> — Product Requirements Document v4.0</div>
          <div>• <code style={{ background: 'rgba(240,237,232,0.06)', padding: '2px 6px', borderRadius: 4 }}>docs/API.md</code> — API spec</div>
        </div>
      </Section>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: '0.62rem', color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(4,8,15,0.6)', border: '1px solid rgba(240,237,232,0.12)',
  borderRadius: 8, padding: '9px 12px', color: '#f0ede8', fontSize: '0.8rem',
  fontFamily: 'inherit', outline: 'none',
}

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8,
  background: 'linear-gradient(90deg, #00e5ff, #a855f7)', border: 'none',
  color: '#04080f', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700,
  letterSpacing: '0.05em', textTransform: 'uppercase',
}

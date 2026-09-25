'use client'

/**
 * /analytics — Cost, metrics, charts
 */

import { useEffect, useState } from 'react'
import { BarChart3, DollarSign, Activity, Clock, TrendingUp, PieChart as PieIcon, Users, Zap } from 'lucide-react'
import { BarChart, HorizontalBar, PieChart, LineChart, StackedBarChart } from '@/components/analytics/ChartComponents'

type Range = '24h' | '7d' | '30d'

const AGENT_COLORS: Record<string, string> = {
  chief: '#00e5ff',
  research: '#00e5ff',
  programmer: '#f5a623',
  qa: '#34d399',
  creator: '#f5a623',
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('7d')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = async (r: Range) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/mc/metrics?range=${r}`)
      const d = await res.json()
      setData(d)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMetrics(range) }, [range])

  if (loading && !data) {
    return (
      <div style={{ padding: 40, color: '#64748b', fontFamily: 'monospace' }}>
        Loading analytics…
      </div>
    )
  }

  if (!data) {
    return <div style={{ padding: 40, color: '#ef4444', fontFamily: 'monospace' }}>Failed to load metrics</div>
  }

  const s = data.summary
  const c = data.costs
  const ch = data.charts

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      padding: '20px 24px 40px',
      background: '#04080f',
      color: '#f0ede8',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
          Analytics
        </h1>
        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{s.total_tasks} total tasks • ${c.total.toFixed(2)} total cost</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['24h', '7d', '30d'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{
                padding: '6px 12px', borderRadius: 8,
                background: range === r ? 'rgba(52,211,153,0.15)' : 'rgba(240,237,232,0.04)',
                border: `1px solid ${range === r ? 'rgba(52,211,153,0.4)' : 'rgba(240,237,232,0.1)'}`,
                color: range === r ? '#34d399' : '#94a3b8',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700,
              }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Top 4 StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Tasks 24h" value={String(s.total_24h)} sub={`${s.done_24h} done, ${s.failed_24h} failed`} icon={Activity} color="#00e5ff" />
        <StatCard label="Success Rate" value={`${s.success_rate}%`} sub={`${s.done} done / ${s.failed} failed overall`} icon={TrendingUp} color={s.success_rate >= 80 ? '#34d399' : '#f5a623'} />
        <StatCard label="Total Cost Today" value={`$${c.today.toFixed(4)}`} sub={`Week $${c.week.toFixed(2)} • Month $${c.month.toFixed(2)}`} icon={DollarSign} color="#f5a623" />
        <StatCard label="Avg Duration" value={`${s.avg_duration_sec}s`} sub={`p50 ${s.p50_latency_sec}s • p95 ${s.p95_latency_sec}s • ${s.token_per_min} tok/min`} icon={Clock} color="#a855f7" />
      </div>

      {/* Second row stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MiniStat label="Queue Depth" value={String(s.queue_depth)} color="#f5a623" />
        <MiniStat label="Active Agents" value={String(s.active_agents)} color="#34d399" />
        <MiniStat label="Running" value={String(s.running)} color="#00e5ff" />
        <MiniStat label="Pending" value={String(s.pending)} color="#94a3b8" />
        <MiniStat label="Total Cost" value={`$${c.total.toFixed(2)}`} color="#f5a623" />
        <MiniStat label="Tokens Today" value={`${(c.tokens_today ?? 0).toLocaleString()}`} color="#a855f7" />
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>

        {/* Tasks per day */}
        <ChartCard title="Tasks per Day" icon={BarChart3} accent="#00e5ff">
          <BarChart
            data={ch.tasks_per_day.map((d: any) => ({
              label: d.day.slice(5),
              value: d.total,
              sub: d.failed,
              color: '#00e5ff',
            }))}
            height={140}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.6rem', color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#00e5ff', borderRadius: 2, display: 'inline-block' }} /> Total</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: '#ef4444aa', borderRadius: 2, display: 'inline-block' }} /> Failed</span>
          </div>
        </ChartCard>

        {/* Queue depth over time */}
        <ChartCard title="Queue Depth 24h" icon={Activity} accent="#f5a623">
          <LineChart
            data={ch.queue_over_time_24h.map((d: any) => ({ label: d.hour.slice(11, 16), value: d.created }))}
            height={120}
            color="#f5a623"
          />
        </ChartCard>

        {/* Cost per agent 7d stacked */}
        <ChartCard title="Cost per Agent (7d)" icon={DollarSign} accent="#f5a623">
          {ch.cost_per_agent_7d.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.75rem', padding: 20, textAlign: 'center' }}>No cost data last 7 days</div>
          ) : (
            (() => {
              // Group by day
              const byDay: Record<string, { key: string; value: number; color: string }[]> = {}
              for (const r of ch.cost_per_agent_7d) {
                if (!byDay[r.day]) byDay[r.day] = []
                byDay[r.day].push({ key: r.agent_id, value: r.cost, color: AGENT_COLORS[r.agent_id] || '#94a3b8' })
              }
              const stacked = Object.entries(byDay).map(([day, stacks]) => ({ label: day.slice(5), stacks }))
              return <StackedBarChart data={stacked} height={140} />
            })()
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(AGENT_COLORS).map(([id, col]) => (
              <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', color: '#94a3b8' }}>
                <span style={{ width: 8, height: 8, background: col, borderRadius: 2, display: 'inline-block' }} /> {id}
              </span>
            ))}
          </div>
        </ChartCard>

        {/* Success rate per agent */}
        <ChartCard title="Success Rate per Agent" icon={Users} accent="#34d399">
          <HorizontalBar
            data={ch.success_per_agent.map((d: any) => ({
              label: d.agent_id,
              value: d.success_rate,
              color: d.success_rate >= 80 ? '#34d399' : d.success_rate >= 50 ? '#f5a623' : '#ef4444',
            }))}
          />
        </ChartCard>

        {/* Token usage per model pie */}
        <ChartCard title="Cost by Model" icon={PieIcon} accent="#a855f7">
          <PieChart
            data={ch.tokens_per_model.map((d: any, i: number) => ({
              label: d.model,
              value: d.cost,
              color: ['#00e5ff', '#f5a623', '#a855f7', '#34d399', '#ef4444', '#94a3b8'][i % 6],
            }))}
            size={160}
          />
        </ChartCard>

        {/* Avg duration per agent */}
        <ChartCard title="Avg Duration per Agent" icon={Clock} accent="#00e5ff">
          <HorizontalBar
            data={ch.avg_duration_per_agent.map((d: any) => ({
              label: d.agent_id,
              value: Math.round(d.avg_sec || 0),
              max: Math.max(1, ...ch.avg_duration_per_agent.map((x: any) => Math.round(x.avg_sec || 0))),
              color: AGENT_COLORS[d.agent_id] || '#00e5ff',
            }))}
          />
        </ChartCard>

        {/* Duration histogram */}
        <ChartCard title="Duration Distribution" icon={Zap} accent="#a855f7">
          <BarChart
            data={ch.duration_histogram.map((b: any) => ({
              label: b.label,
              value: b.count,
              color: '#a855f7',
            }))}
            height={120}
            color="#a855f7"
          />
        </ChartCard>

        {/* Cost per agent total */}
        <ChartCard title="Total Cost per Agent" icon={DollarSign} accent="#f5a623">
          <BarChart
            data={ch.cost_per_agent_total.map((d: any) => ({
              label: d.agent_id,
              value: Number(d.cost.toFixed(2)),
              color: AGENT_COLORS[d.agent_id] || '#f5a623',
            }))}
            height={120}
            color="#f5a623"
          />
        </ChartCard>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub: string; icon: any; color: string }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)', border: `1px solid ${color}30`, borderRadius: 12,
      padding: '16px 18px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${color}12` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(240,237,232,0.03)', border: '1px solid rgba(240,237,232,0.07)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function ChartCard({ title, icon: Icon, accent, children }: { title: string; icon: any; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: 14,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accent}18`, border: `1px solid ${accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={accent} />
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f0ede8' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

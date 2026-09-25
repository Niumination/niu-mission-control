/**
 * GET /api/mc/metrics — aggregated metrics for Analytics page
 * Query: range=24h|7d|30d (default 7d)
 */

import db from '@/lib/server/db'
import { withAuth, json } from '@/lib/server/api-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const QuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d']).default('7d'),
})

function daysForRange(range: string): number {
  switch (range) {
    case '24h': return 1
    case '7d': return 7
    case '30d': return 30
    default: return 7
  }
}

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({ range: url.searchParams.get('range') || '7d' })
  const range = parsed.success ? parsed.data.range : '7d'
  const days = daysForRange(range)

  // Total tasks counts
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) as running,
           SUM(CASE WHEN status IN ('inbox','queued','review') THEN 1 ELSE 0 END) as pending
    FROM tasks
  `).get() as any

  const total24h = db.prepare(`
    SELECT COUNT(*) as c,
           SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM tasks WHERE created_at >= datetime('now', '-1 day')
  `).get() as any

  const successRate = totalRow.total > 0 ? Math.round(((totalRow.done ?? 0) / Math.max(1, (totalRow.done ?? 0) + (totalRow.failed ?? 0))) * 100) : 0

  // Tasks per day last N days
  const tasksPerDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as total,
           SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM tasks
    WHERE created_at >= date('now', '-${days} days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all() as any[]

  // Cost totals
  const costToday = db.prepare(`SELECT COALESCE(SUM(cost_usd),0) as cost, COALESCE(SUM(input_tokens+output_tokens),0) as tokens FROM cost_tracking WHERE recorded_at >= date('now')`).get() as any
  const costWeek = db.prepare(`SELECT COALESCE(SUM(cost_usd),0) as cost FROM cost_tracking WHERE recorded_at >= date('now','-7 days')`).get() as any
  const costMonth = db.prepare(`SELECT COALESCE(SUM(cost_usd),0) as cost FROM cost_tracking WHERE recorded_at >= date('now','-30 days')`).get() as any
  const costTotal = db.prepare(`SELECT COALESCE(SUM(cost_usd),0) as cost FROM cost_tracking`).get() as any

  // Cost per agent last 7 days (stacked)
  const costPerAgent = db.prepare(`
    SELECT agent_id, date(recorded_at) as day, SUM(cost_usd) as cost
    FROM cost_tracking
    WHERE recorded_at >= date('now','-7 days')
    GROUP BY agent_id, date(recorded_at)
    ORDER BY day ASC
  `).all() as any[]

  // Cost per agent total (for pie/bar)
  const costPerAgentTotal = db.prepare(`
    SELECT agent_id, SUM(cost_usd) as cost, SUM(input_tokens) as input_tok, SUM(output_tokens) as output_tok, COUNT(*) as cnt
    FROM cost_tracking GROUP BY agent_id ORDER BY cost DESC
  `).all() as any[]

  // Token usage per model
  const tokensPerModel = db.prepare(`
    SELECT model, SUM(input_tokens) as input_tok, SUM(output_tokens) as output_tok, SUM(cost_usd) as cost, COUNT(*) as cnt
    FROM cost_tracking GROUP BY model ORDER BY cost DESC
  `).all() as any[]

  // Success rate per agent
  const successPerAgent = db.prepare(`
    SELECT assigned_agent as agent_id,
           COUNT(*) as total,
           SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
    FROM tasks WHERE assigned_agent IS NOT NULL GROUP BY assigned_agent
  `).all() as any[]
  for (const r of successPerAgent) {
    r.success_rate = (r.done + r.failed) > 0 ? Math.round((r.done / (r.done + r.failed)) * 100) : 0
  }

  // Avg duration per agent
  const avgDurationPerAgent = db.prepare(`
    SELECT assigned_agent as agent_id,
           AVG((julianday(completed_at)-julianday(started_at))*86400.0) as avg_sec,
           COUNT(*) as cnt
    FROM tasks WHERE completed_at IS NOT NULL AND started_at IS NOT NULL GROUP BY assigned_agent
  `).all() as any[]

  // Queue depth over time (last 24h per hour) — count tasks created per hour
  const queueOverTime = db.prepare(`
    SELECT strftime('%Y-%m-%d %H:00', created_at) as hour, COUNT(*) as created,
           SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as completed
    FROM tasks WHERE created_at >= datetime('now','-1 day') GROUP BY hour ORDER BY hour ASC
  `).all() as any[]

  // Task duration histogram (buckets: 0-5s, 5-15s, 15-30s, 30-60s, 60-120s, 120s+)
  const durations = db.prepare(`
    SELECT (julianday(completed_at)-julianday(started_at))*86400.0 as dur
    FROM tasks WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
  `).all() as { dur: number }[]
  const buckets = [
    { label: '0-5s', min: 0, max: 5, count: 0 },
    { label: '5-15s', min: 5, max: 15, count: 0 },
    { label: '15-30s', min: 15, max: 30, count: 0 },
    { label: '30-60s', min: 30, max: 60, count: 0 },
    { label: '1-2m', min: 60, max: 120, count: 0 },
    { label: '2m+', min: 120, max: Infinity, count: 0 },
  ]
  for (const d of durations) {
    const dur = d.dur
    for (const b of buckets) {
      if (dur >= b.min && dur < b.max) { b.count++; break }
    }
  }

  // Token per minute (last hour)
  const tokenLastHour = db.prepare(`
    SELECT COALESCE(SUM(input_tokens+output_tokens),0) as tokens FROM cost_tracking WHERE recorded_at >= datetime('now','-1 hour')
  `).get() as any
  const tokenPerMin = Math.round((tokenLastHour.tokens ?? 0) / 60)

  // p50/p95 latency (from durations sorted)
  const sortedDurs = durations.map(d => d.dur).sort((a, b) => a - b)
  const p50 = sortedDurs.length > 0 ? sortedDurs[Math.floor(sortedDurs.length * 0.5)] : 0
  const p95 = sortedDurs.length > 0 ? sortedDurs[Math.floor(sortedDurs.length * 0.95)] : 0

  // Active agents
  const activeAgents = (db.prepare(`SELECT COUNT(*) as c FROM agents WHERE status IN ('online','working','idle') AND enabled=1`).get() as any).c
  const queueDepth = (db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE status IN ('inbox','queued','running')`).get() as any).c

  return json({
    range,
    summary: {
      total_tasks: totalRow.total ?? 0,
      done: totalRow.done ?? 0,
      failed: totalRow.failed ?? 0,
      running: totalRow.running ?? 0,
      pending: totalRow.pending ?? 0,
      success_rate: successRate,
      total_24h: total24h.c ?? 0,
      done_24h: total24h.done ?? 0,
      failed_24h: total24h.failed ?? 0,
      queue_depth: queueDepth,
      active_agents: activeAgents,
      avg_duration_sec: sortedDurs.length > 0 ? Math.round(sortedDurs.reduce((a, b) => a + b, 0) / sortedDurs.length) : 0,
      p50_latency_sec: Math.round(p50),
      p95_latency_sec: Math.round(p95),
      token_per_min: tokenPerMin,
    },
    costs: {
      today: costToday.cost ?? 0,
      week: costWeek.cost ?? 0,
      month: costMonth.cost ?? 0,
      total: costTotal.cost ?? 0,
      tokens_today: costToday.tokens ?? 0,
    },
    charts: {
      tasks_per_day: tasksPerDay,
      cost_per_agent_7d: costPerAgent,
      cost_per_agent_total: costPerAgentTotal,
      tokens_per_model: tokensPerModel,
      success_per_agent: successPerAgent,
      avg_duration_per_agent: avgDurationPerAgent,
      queue_over_time_24h: queueOverTime,
      duration_histogram: buckets,
    },
  })
})

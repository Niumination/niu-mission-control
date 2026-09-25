/**
 * GET  /api/mc/agents      — list agents dengan stats
 * POST /api/mc/agents      — create agent (admin)
 */

import db from '@/lib/server/db'
import { withAuth, json, parseBody, ApiError } from '@/lib/server/api-helpers'
import { CreateAgentSchema } from '@/lib/server/schema'
import { audit } from '@/lib/server/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Stats per agent — pakai subquery untuk hindari cartesian product tasks x cost_tracking
const STATS_SQL = `
  SELECT
    a.*,
    (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent = a.id) as total_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent = a.id AND t.status = 'done') as completed_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent = a.id AND t.status = 'failed') as failed_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent = a.id AND t.status = 'running') as running_tasks,
    (SELECT COUNT(*) FROM tasks t WHERE t.assigned_agent = a.id AND t.status IN ('inbox','queued','review')) as pending_tasks,
    COALESCE((SELECT SUM(cost_usd) FROM cost_tracking ct WHERE ct.agent_id = a.id), 0) as total_cost_usd,
    COALESCE((SELECT SUM(input_tokens) FROM cost_tracking ct WHERE ct.agent_id = a.id), 0) as total_input_tokens,
    COALESCE((SELECT SUM(output_tokens) FROM cost_tracking ct WHERE ct.agent_id = a.id), 0) as total_output_tokens,
    (SELECT AVG((julianday(completed_at) - julianday(started_at)) * 86400.0) FROM tasks t WHERE t.assigned_agent = a.id AND t.completed_at IS NOT NULL AND t.started_at IS NOT NULL) as avg_duration_sec,
    (
      SELECT t2.id FROM tasks t2
      WHERE t2.assigned_agent = a.id AND t2.status = 'running'
      ORDER BY t2.started_at DESC LIMIT 1
    ) as current_task_id,
    (
      SELECT t2.title FROM tasks t2
      WHERE t2.assigned_agent = a.id AND t2.status = 'running'
      ORDER BY t2.started_at DESC LIMIT 1
    ) as current_task_title
  FROM agents a
  ORDER BY
    CASE a.id WHEN 'chief' THEN 0 ELSE 1 END,
    a.id
`

// Sparkline: tasks per hour last 24h per agent (for frontend mini chart)
function getSparklineData() {
  try {
    const rows = db.prepare(`
      SELECT assigned_agent as agent_id,
             strftime('%H', created_at) as hour,
             COUNT(*) as cnt
      FROM tasks
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY assigned_agent, hour
      ORDER BY assigned_agent, hour
    `).all() as { agent_id: string; hour: string; cnt: number }[]
    const map: Record<string, number[]> = {}
    for (const r of rows) {
      if (!map[r.agent_id]) map[r.agent_id] = Array(24).fill(0)
      const h = parseInt(r.hour, 10)
      if (h >= 0 && h < 24) map[r.agent_id][h] = r.cnt
    }
    return map
  } catch {
    return {}
  }
}

export const GET = withAuth(async () => {
  const agents = db.prepare(STATS_SQL).all() as any[]
  const sparkline = getSparklineData()
  // Enrich dengan success_rate + sparkline
  for (const a of agents) {
    const completed = a.completed_tasks ?? 0
    const failed = a.failed_tasks ?? 0
    const totalDone = completed + failed
    a.success_rate = totalDone > 0 ? Math.round((completed / totalDone) * 100) : 0
    a.sparkline_24h = sparkline[a.id] || Array(24).fill(0)
    // Normalize cost
    a.total_cost_usd = Number(a.total_cost_usd || 0)
    a.avg_duration_sec = a.avg_duration_sec ? Math.round(a.avg_duration_sec) : null
  }
  return json({ agents, total: agents.length })
})

export const POST = withAuth(async ({ actor, req }) => {
  const body = await parseBody(req, CreateAgentSchema)

  // Check id uniqueness
  const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(body.id)
  if (existing) throw new ApiError(409, `Agent with id '${body.id}' already exists`)

  db.prepare(
    `INSERT INTO agents (id, name, role, description, color, model_default, adapter, system_prompt, status)
     VALUES (@id, @name, @role, @description, @color, @model_default, @adapter, @system_prompt, 'offline')`
  ).run({
    id: body.id,
    name: body.name,
    role: body.role,
    description: body.description ?? null,
    color: body.color,
    model_default: body.model_default ?? null,
    adapter: body.adapter,
    system_prompt: body.system_prompt ?? null,
  })

  audit(actor.name, actor.type as 'user' | 'api_key', 'agent.create', 'agent', body.id, 'success', { body })

  const newAgent = db.prepare('SELECT * FROM agents WHERE id = ?').get(body.id)
  return json({ agent: newAgent }, { status: 201 })
})

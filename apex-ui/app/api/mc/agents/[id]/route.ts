/**
 * GET  /api/mc/agents/:id — detail agent + recent tasks + cost breakdown + 7-day activity
 * PATCH /api/mc/agents/:id — update config (model, system_prompt, color, enabled, etc)
 */

import db from '@/lib/server/db'
import { withAuth, json, parseBody, ApiError } from '@/lib/server/api-helpers'
import { UpdateAgentSchema, AgentIdSchema } from '@/lib/server/schema'
import { audit } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = withAuth(async ({ req }) => {
  const id = req.nextUrl.pathname.split('/').pop()!
  const parsed = AgentIdSchema.safeParse(id)
  if (!parsed.success) throw new ApiError(400, 'Invalid agent ID')
  const agentId = parsed.data

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any
  if (!agent) throw new ApiError(404, 'Agent not found')

  // Stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status IN ('inbox','queued','review') THEN 1 ELSE 0 END) as pending,
      AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL THEN (julianday(completed_at)-julianday(started_at))*86400.0 ELSE NULL END) as avg_duration
    FROM tasks WHERE assigned_agent = ?
  `).get(agentId) as any

  const cost = db.prepare(`
    SELECT COALESCE(SUM(cost_usd),0) as total_cost,
           COALESCE(SUM(input_tokens),0) as input_tokens,
           COALESCE(SUM(output_tokens),0) as output_tokens,
           COUNT(*) as records
    FROM cost_tracking WHERE agent_id = ?
  `).get(agentId) as any

  const costByModel = db.prepare(`
    SELECT model, SUM(cost_usd) as cost, SUM(input_tokens) as input_tok, SUM(output_tokens) as output_tok, COUNT(*) as cnt
    FROM cost_tracking WHERE agent_id = ? GROUP BY model ORDER BY cost DESC
  `).all(agentId) as any[]

  const recentTasks = db.prepare(`
    SELECT t.*, a.name as agent_name, a.color as agent_color
    FROM tasks t LEFT JOIN agents a ON t.assigned_agent = a.id
    WHERE t.assigned_agent = ?
    ORDER BY t.created_at DESC LIMIT 20
  `).all(agentId) as any[]

  // 7-day activity: tasks per day last 7 days
  const activity7d = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as cnt,
           SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_cnt,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed_cnt
    FROM tasks WHERE assigned_agent = ? AND created_at >= date('now','-7 days')
    GROUP BY date(created_at) ORDER BY day ASC
  `).all(agentId) as any[]

  // Recent system logs for this agent (if any)
  const logs = db.prepare(`
    SELECT * FROM system_logs WHERE source = ? OR task_id IN (SELECT id FROM tasks WHERE assigned_agent = ?)
    ORDER BY created_at DESC LIMIT 50
  `).all(agentId, agentId) as any[]

  const completed = stats.completed ?? 0
  const failed = stats.failed ?? 0
  const successRate = completed + failed > 0 ? Math.round((completed / (completed + failed)) * 100) : 0

  return json({
    agent,
    stats: { ...stats, success_rate: successRate, avg_duration: stats.avg_duration ? Math.round(stats.avg_duration) : null },
    cost: { ...cost, by_model: costByModel },
    recent_tasks: recentTasks,
    activity_7d: activity7d,
    logs,
  })
})

export const PATCH = withAuth(async ({ actor, req }) => {
  const id = req.nextUrl.pathname.split('/').pop()!
  const parsed = AgentIdSchema.safeParse(id)
  if (!parsed.success) throw new ApiError(400, 'Invalid agent ID')
  const agentId = parsed.data

  const body = await parseBody(req, UpdateAgentSchema)
  const existing = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any
  if (!existing) throw new ApiError(404, 'Agent not found')

  const allowedFields = ['name', 'role', 'description', 'color', 'model_default', 'system_prompt', 'enabled', 'status']
  const updates: Record<string, unknown> = {}
  for (const k of allowedFields) {
    if ((body as any)[k] !== undefined) updates[k] = (body as any)[k]
  }

  if (Object.keys(updates).length === 0) throw new ApiError(400, 'No fields to update')

  const sets = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
  const params = { ...updates, id: agentId }

  db.prepare(`UPDATE agents SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run(params)

  audit(actor.name, actor.type as 'user' | 'api_key', 'agent.update', 'agent', agentId, 'success', { fields: Object.keys(updates) })

  const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId)
  return json({ agent: updated })
})

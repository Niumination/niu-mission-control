/**
 * GET    /api/mc/tasks/:id        — detail task + timeline
 * PATCH  /api/mc/tasks/:id        — update task (status, priority, dll.)
 * DELETE /api/mc/tasks/:id        — cancel task (tidak menghapus dari DB, hanya set cancelled)
 */

import db from '@/lib/server/db'
import { withAuth, json, parseBody, ApiError } from '@/lib/server/api-helpers'
import { UpdateTaskSchema, TaskIdSchema, TaskStatusSchema } from '@/lib/server/schema'
import { audit } from '@/lib/server/auth'
import { canTransition } from '@/lib/server/state-machine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TASK_SELECT = `
  SELECT t.*, a.name as agent_name, a.color as agent_color
  FROM tasks t
  LEFT JOIN agents a ON t.assigned_agent = a.id
  WHERE t.id = ?
`

export const GET = withAuth(async ({ req }) => {
  const id = req.nextUrl.pathname.split('/').pop()!
  const parsed = TaskIdSchema.safeParse(id)
  if (!parsed.success) throw new ApiError(400, 'Invalid task ID')

  const task = db.prepare(TASK_SELECT).get(parsed.data) as any
  if (!task) throw new ApiError(404, 'Task not found')

  // Parse metadata JSON
  if (task.metadata) {
    try { task.metadata = JSON.parse(task.metadata) } catch { /* biarkan string */ }
  }

  // Timeline events
  const timeline = db
    .prepare(
      `SELECT id, event_type, payload, actor, created_at
       FROM events
       WHERE aggregate_type = 'task' AND aggregate_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(parsed.data) as any[]
  for (const ev of timeline) {
    try { ev.payload = JSON.parse(ev.payload) } catch {}
  }

  // Artifacts
  const artifacts = db
    .prepare(`SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at ASC`)
    .all(parsed.data)

  // Cost records
  const costs = db
    .prepare(
      `SELECT model, provider, SUM(input_tokens) as input_tokens,
              SUM(output_tokens) as output_tokens,
              SUM(cache_read_tokens) as cache_read,
              SUM(cost_usd) as cost_usd
       FROM cost_tracking WHERE task_id = ?
       GROUP BY model, provider`
    )
    .all(parsed.data)

  return json({ task, timeline, artifacts, costs })
})

export const PATCH = withAuth(async ({ actor, req }) => {
  const id = req.nextUrl.pathname.split('/').pop()!
  const taskIdParse = TaskIdSchema.safeParse(id)
  if (!taskIdParse.success) throw new ApiError(400, 'Invalid task ID')
  const taskId = taskIdParse.data

  const body = await parseBody(req, UpdateTaskSchema)

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
  if (!existing) throw new ApiError(404, 'Task not found')

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { ...body }
  const sets: string[] = []
  const params: Record<string, unknown> = { id: taskId }

  // Status transition validation — use central state-machine
  if (body.status) {
    const current = existing.status as string
    const next = body.status as string
    if (!canTransition(current as any, next as any)) {
      throw new ApiError(409, `Invalid status transition: ${current} → ${next}`)
    }
    // Set timestamps sesuai target status
    if (next === 'queued' && !existing.queued_at) updates.queued_at = now
    if (next === 'running') {
      if (!existing.claimed_at) updates.claimed_at = now
      updates.started_at = now
      updates.progress = 0
    }
    if (next === 'review') updates.submitted_at = now
    if (next === 'done') {
      updates.completed_at = now
      updates.progress = 100
    }
    if (next === 'failed') updates.failed_at = now
  }

  if (body.metadata && typeof body.metadata === 'object') {
    updates.metadata = JSON.stringify(body.metadata)
  }

  for (const [key, value] of Object.entries(updates)) {
    sets.push(`${key} = @${key}`)
    params[key] = value
  }

  if (sets.length === 0) {
    throw new ApiError(400, 'No fields to update')
  }

  const tx = db.transaction(() => {
    db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = @id`).run(params)

    // Emit event
    if (body.status) {
      db.prepare(
        `INSERT INTO events (aggregate_type, aggregate_id, event_type, payload, actor, created_at)
         VALUES ('task', @id, @eventType, @payload, @actor, @now)`
      ).run({
        id: taskId,
        eventType: `task.${body.status}`,
        payload: JSON.stringify({ from: existing.status, to: body.status }),
        actor: actor.name,
        now,
      })
    }
  })
  tx()

  audit(
    actor.name,
    actor.type as 'user' | 'api_key',
    body.status ? `task.${body.status}` : 'task.update',
    'task',
    taskId,
    'success',
    { fields: Object.keys(body) }
  )

  const task = db.prepare(TASK_SELECT).get(taskId)
  return json({ task })
})

// Cancel = soft delete (set status cancelled)
export const DELETE = withAuth(async ({ actor, req }) => {
  const id = req.nextUrl.pathname.split('/').pop()!
  const parsed = TaskIdSchema.safeParse(id)
  if (!parsed.success) throw new ApiError(400, 'Invalid task ID')
  const taskId = parsed.data

  const existing = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as any
  if (!existing) throw new ApiError(404, 'Task not found')
  if (['done', 'cancelled', 'failed'].includes(existing.status)) {
    throw new ApiError(409, `Cannot cancel task in status '${existing.status}'`)
  }

  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare(`UPDATE tasks SET status = 'cancelled' WHERE id = ?`).run(taskId)
    db.prepare(
      `INSERT INTO events (aggregate_type, aggregate_id, event_type, payload, actor, created_at)
       VALUES ('task', ?, 'task.cancelled', ?, ?, ?)`
    ).run(taskId, JSON.stringify({ from: existing.status }), actor.name, now)
  })
  tx()

  audit(actor.name, actor.type as 'user' | 'api_key', 'task.cancel', 'task', taskId, 'success')
  return json({ success: true, id: taskId, status: 'cancelled' })
})

/**
 * POST /api/mc/dispatch
 *
 * Endpoint penerima instruksi (dari UI, Telegram, CLI via API key, webhook).
 * Fungsinya adalah shortcut yang memaksa tugas masuk ke antrian (queued)
 * dengan agent default 'chief' (orchestrator), lalu menyerahkan ke worker loop.
 *
 * Flow:
 *   POST /api/mc/dispatch
 *     → validasi body (CreateTaskSchema, field `to` jadi agent opsional)
 *     → buat task status 'queued', agent = body.to || 'chief'
 *     → worker loop (3s) meng-claim, jalankan adapter (hermes/mock)
 *     → hasil/cost/artifacts disimpan
 *
 * GET /api/mc/dispatch
 *   → alias list tasks terbaru (untuk backward-compatible).
 */

import crypto from 'crypto'
import db from '@/lib/server/db'
import { withAuth, json, parseBody, parseQuery } from '@/lib/server/api-helpers'
import { CreateTaskSchema, ListTasksQuerySchema } from '@/lib/server/schema'
import { audit } from '@/lib/server/auth'
import { emitTaskEvent } from '@/lib/server/events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function generateTaskId(): string {
  return `t${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`
}

export const GET = withAuth(async ({ req }) => {
  const q = parseQuery(req, ListTasksQuerySchema)
  const where: string[] = []
  const params: Record<string, unknown> = { limit: q.limit, offset: q.offset }
  if (q.status)   { where.push('t.status = @status');   params.status = q.status }
  if (q.agent)    { where.push('t.assigned_agent = @agent'); params.agent = q.agent }
  if (q.priority) { where.push('t.priority = @priority'); params.priority = q.priority }
  if (q.search)   {
    where.push('(t.title LIKE @s OR t.description LIKE @s OR t.id LIKE @s)')
    params.s = `%${q.search}%`
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = db.prepare(`
    SELECT t.*, a.name as agent_name, a.color as agent_color
    FROM tasks t LEFT JOIN agents a ON t.assigned_agent = a.id
    ${whereSql}
    ORDER BY
      CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END,
      t.created_at DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: q.limit, offset: q.offset })
  const total = (db.prepare(`SELECT COUNT(*) as c FROM tasks t ${whereSql}`).get(params) as { c: number }).c
  return json({ tasks: rows, total })
})

export const POST = withAuth(async ({ actor, req }) => {
  const body = await parseBody(req, CreateTaskSchema)
  const now = new Date().toISOString()
  const taskId = generateTaskId()

  // Default agent = chief (orchestrator) — override via body.to / body.agent
  const assignedAgent = body.agent || 'chief'

  // Validasi agent exists
  const agent = db.prepare('SELECT id, status FROM agents WHERE id = ?').get(assignedAgent) as
    | { id: string; status: string } | undefined
  if (!agent) {
    return json({ error: `Agent '${assignedAgent}' tidak ditemukan` }, { status: 400 })
  }

  // Insert langsung queued agar worker bisa pick up
  db.prepare(`
    INSERT INTO tasks (
      id, title, description, instruction, assigned_agent, priority,
      status, source, depends_on, deadline_at, metadata,
      retry_count, created_at, queued_at
    ) VALUES (
      @id, @title, @description, @instruction, @assigned_agent, @priority,
      'queued', @source, @depends_on, @deadline_at, @metadata,
      0, @now, @now
    )
  `).run({
    id: taskId,
    title: body.title,
    description: body.description ?? null,
    instruction: body.instruction ?? body.description ?? null,
    assigned_agent: assignedAgent,
    priority: body.priority,
    source: body.source,
    depends_on: body.depends_on ?? null,
    deadline_at: body.deadline_at ?? null,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    now,
  })

  emitTaskEvent(taskId, 'task.queued', { title: body.title, agent: assignedAgent, priority: body.priority })
  audit(
    actor.name,
    actor.type as 'user' | 'api_key',
    'dispatch.create',
    'task',
    taskId,
    'success',
    { title: body.title.slice(0, 80), agent: assignedAgent, priority: body.priority },
  )

  const task = db.prepare(
    `SELECT t.*, a.name as agent_name, a.color as agent_color
     FROM tasks t LEFT JOIN agents a ON t.assigned_agent = a.id WHERE t.id = ?`
  ).get(taskId)
  return json({ id: taskId, status: 'queued', task }, { status: 201 })
})

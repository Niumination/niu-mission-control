/**
 * GET  /api/mc/tasks      — list tasks (bisa filter: status, agent, priority, search, limit, offset)
 * POST /api/mc/tasks      — create task baru
 */

import db from '@/lib/server/db'
import { withAuth, json, parseBody, parseQuery, ApiError } from '@/lib/server/api-helpers'
import { CreateTaskSchema, ListTasksQuerySchema } from '@/lib/server/schema'
import { audit } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function buildListWhere(filters: {
  status?: string
  agent?: string
  priority?: string
  search?: string
}): { where: string; params: Record<string, unknown> } {
  const clauses: string[] = []
  const params: Record<string, unknown> = {}
  if (filters.status) {
    clauses.push('t.status = @status')
    params.status = filters.status
  }
  if (filters.agent) {
    clauses.push('t.assigned_agent = @agent')
    params.agent = filters.agent
  }
  if (filters.priority) {
    clauses.push('t.priority = @priority')
    params.priority = filters.priority
  }
  if (filters.search) {
    clauses.push('(t.title LIKE @search OR t.description LIKE @search OR t.id LIKE @search)')
    params.search = `%${filters.search}%`
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  }
}

export const GET = withAuth(async ({ req }) => {
  const filters = parseQuery(req, ListTasksQuerySchema)
  const { where, params } = buildListWhere(filters)

  // Support grouped result saat tidak ada filter status (untuk kanban)
  if (!filters.status) {
    const groups: Record<string, unknown[]> = { inbox: [], queued: [], running: [], review: [], done: [], failed: [], cancelled: [] }
    const rows = db
      .prepare(
        `SELECT t.*, a.name as agent_name, a.color as agent_color
         FROM tasks t
         LEFT JOIN agents a ON t.assigned_agent = a.id
         ${where}
         ORDER BY
           CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END,
           t.created_at DESC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: filters.limit, offset: filters.offset }) as any[]
    for (const r of rows) {
      const s = r.status
      if (groups[s]) groups[s].push(r)
      else groups.inbox.push(r) // fallback
    }
    return json({ ...groups, total: rows.length, limit: filters.limit, offset: filters.offset })
  }

  const rows = db
    .prepare(
      `SELECT t.*, a.name as agent_name, a.color as agent_color
       FROM tasks t
       LEFT JOIN agents a ON t.assigned_agent = a.id
       ${where}
       ORDER BY
         CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END,
         t.created_at DESC
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: filters.limit, offset: filters.offset })

  return json({ tasks: rows, total: (rows as unknown[]).length, limit: filters.limit, offset: filters.offset })
})

function generateTaskId(): string {
  const now = Date.now()
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')
  return `t${now}${rand}`
}

export const POST = withAuth(async ({ actor, req }) => {
  const body = await parseBody(req, CreateTaskSchema)

  // Idempotency: jika key diberikan, cek existing
  if (body.idempotency_key) {
    const existing = db
      .prepare('SELECT * FROM tasks WHERE idempotency_key = ?')
      .get(body.idempotency_key)
    if (existing) {
      return json({ task: existing, idempotent: true })
    }
  }

  // Validasi agent exists jika diset
  if (body.agent) {
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(body.agent)
    if (!agent) throw new ApiError(400, `Agent '${body.agent}' not found`)
  }
  if (body.depends_on) {
    const parent = db.prepare('SELECT id FROM tasks WHERE id = ?').get(body.depends_on)
    if (!parent) throw new ApiError(400, `Parent task '${body.depends_on}' not found`)
  }

  const taskId = generateTaskId()
  const now = new Date().toISOString()
  const status = body.agent ? 'queued' : 'inbox'

  db.prepare(
    `INSERT INTO tasks (
       id, title, description, instruction, assigned_agent, status, priority,
       source, depends_on, idempotency_key, deadline_at, metadata,
       created_at, queued_at
     ) VALUES (
       @id, @title, @description, @instruction, @agent, @status, @priority,
       @source, @depends_on, @idempotency_key, @deadline_at, @metadata,
       @created_at, @queued_at
     )`
  ).run({
    id: taskId,
    title: body.title,
    description: body.description ?? null,
    instruction: body.instruction ?? null,
    agent: body.agent ?? null,
    status,
    priority: body.priority,
    source: body.source,
    depends_on: body.depends_on ?? null,
    idempotency_key: body.idempotency_key ?? null,
    deadline_at: body.deadline_at ?? null,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    created_at: now,
    queued_at: body.agent ? now : null,
  })

  // Append event
  db.prepare(
    `INSERT INTO events (aggregate_type, aggregate_id, event_type, payload, actor, created_at)
     VALUES ('task', @id, 'task.created', @payload, @actor, @now)`
  ).run({
    id: taskId,
    payload: JSON.stringify({ title: body.title, agent: body.agent ?? null, priority: body.priority, status }),
    actor: actor.name,
    now,
  })

  audit(
    actor.name,
    actor.type as 'user' | 'api_key',
    'task.create',
    'task',
    taskId,
    'success',
    { title: body.title, agent: body.agent, priority: body.priority }
  )

  const task = db
    .prepare(
      `SELECT t.*, a.name as agent_name, a.color as agent_color
       FROM tasks t LEFT JOIN agents a ON t.assigned_agent = a.id WHERE t.id = ?`
    )
    .get(taskId)

  return json({ task, id: taskId, status: 'created' }, { status: 201 })
})

/**
 * GET /api/mc/audit — list audit_log immutable
 * Query: actor, action, target_type, search, limit, offset, from, to
 */

import db from '@/lib/server/db'
import { withAuth, json } from '@/lib/server/api-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const QuerySchema = z.object({
  actor: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  target_type: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  from: z.string().optional(), // ISO date
  to: z.string().optional(),
})

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    actor: url.searchParams.get('actor') || undefined,
    action: url.searchParams.get('action') || undefined,
    target_type: url.searchParams.get('target_type') || undefined,
    search: url.searchParams.get('search') || undefined,
    limit: url.searchParams.get('limit') || '100',
    offset: url.searchParams.get('offset') || '0',
    from: url.searchParams.get('from') || undefined,
    to: url.searchParams.get('to') || undefined,
  })

  if (!parsed.success) {
    return json({ error: 'Invalid query', details: parsed.error.issues }, { status: 400 })
  }
  const q = parsed.data

  const where: string[] = []
  const params: Record<string, unknown> = {}

  if (q.actor) {
    where.push('actor LIKE @actor')
    params.actor = `%${q.actor}%`
  }
  if (q.action) {
    where.push('action LIKE @action')
    params.action = `%${q.action}%`
  }
  if (q.target_type) {
    where.push('target_type = @target_type')
    params.target_type = q.target_type
  }
  if (q.search) {
    where.push('(actor LIKE @search OR action LIKE @search OR target_id LIKE @search OR details LIKE @search)')
    params.search = `%${q.search}%`
  }
  if (q.from) {
    where.push('created_at >= @from')
    params.from = q.from
  }
  if (q.to) {
    where.push('created_at <= @to')
    params.to = q.to
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const rows = db.prepare(`
    SELECT id, actor, actor_type, action, target_type, target_id, result, details, client_ip, user_agent, created_at
    FROM audit_log
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: q.limit, offset: q.offset }) as any[]

  for (const r of rows) {
    try { if (r.details) r.details = JSON.parse(r.details) } catch {}
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as c FROM audit_log ${whereSql}`).get(params) as { c: number }

  // Distinct values for filter dropdowns
  const actors = db.prepare(`SELECT DISTINCT actor FROM audit_log ORDER BY actor`).all() as { actor: string }[]
  const actions = db.prepare(`SELECT DISTINCT action FROM audit_log ORDER BY action`).all() as { action: string }[]
  const targetTypes = db.prepare(`SELECT DISTINCT target_type FROM audit_log ORDER BY target_type`).all() as { target_type: string }[]

  return json({
    logs: rows,
    total: totalRow.c,
    limit: q.limit,
    offset: q.offset,
    filters: {
      actors: actors.map(a => a.actor),
      actions: actions.map(a => a.action),
      target_types: targetTypes.map(t => t.target_type),
    },
  })
})

/**
 * GET /api/mc/approvals?status=pending&limit=20
 */
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/server/auth'
import { listApprovals } from '@/lib/server/approvals'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Query = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'expired']).default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(req: Request) {
  const auth = await authenticateRequest(req as any)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const url = new URL(req.url)
  const parsed = Query.safeParse({
    status: url.searchParams.get('status') || 'pending',
    limit: url.searchParams.get('limit') || '20',
  })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query', details: parsed.error.issues }, { status: 400 })

  const approvals = listApprovals(parsed.data.status, parsed.data.limit)
  return NextResponse.json({ approvals, total: approvals.length })
}

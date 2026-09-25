/**
 * POST /api/mc/approvals/:id/approve  { reason? }
 */
import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/server/auth'
import { decideApproval } from '@/lib/server/approvals'
import { ApprovalDecisionSchema } from '@/lib/server/schema'
import { ApiError } from '@/lib/server/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authenticateRequest(req as any)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {}
  const parsed = ApprovalDecisionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body', details: parsed.error.issues }, { status: 400 })

  try {
    await decideApproval(id, 'approved', parsed.data.reason ?? null, auth.actor.name, auth.actor.type as 'user' | 'api_key')
    return NextResponse.json({ success: true, id, decision: 'approved' })
  } catch (err: any) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}

/**
 * POST /api/auth/logout  — destroy session
 */

import { getSession } from '@/lib/server/auth'
import { withAuth, json } from '@/lib/server/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const POST = withAuth(async () => {
  const session = await getSession()
  session.destroy()
  return json({ success: true })
})

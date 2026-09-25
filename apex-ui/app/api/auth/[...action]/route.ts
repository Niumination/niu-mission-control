/**
 * POST /api/auth/login    — validate password, set session cookie
 * POST /api/auth/logout   — destroy session
 * GET  /api/auth/me       — return current session info
 */

import { NextRequest } from 'next/server'
import { getSession, verifyPassword } from '@/lib/server/auth'
import { config } from '@/lib/server/env'
import { publicHandler, json, parseBody, ApiError } from '@/lib/server/api-helpers'
import { LoginSchema } from '@/lib/server/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const POST = publicHandler(async (req: NextRequest) => {
  // Jika di mode setup (belum ada password), login route tidak boleh dipakai sebelum setup.
  if (config.password.required) {
    throw new ApiError(403, 'Setup required before login')
  }

  const body = await parseBody(req, LoginSchema)
  const ok = await verifyPassword(body.password, config.password.hash!)
  if (!ok) {
    throw new ApiError(401, 'Invalid password')
  }

  const session = await getSession()
  session.loggedIn = true
  session.loggedInAt = new Date().toISOString()
  session.ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  await session.save()

  return json({ success: true })
})

export const GET = publicHandler(async () => {
  if (config.password.required) {
    return json({ setupRequired: true })
  }
  const session = await getSession()
  return json({
    authenticated: !!session.loggedIn,
    loggedInAt: session.loggedInAt ?? null,
  })
})

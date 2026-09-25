/**
 * GET /api/mc/backups — list backups
 * POST /api/mc/backups — trigger manual backup
 */

import { withAuth, json } from '@/lib/server/api-helpers'
import { listBackups, runBackup } from '@/lib/server/backup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const GET = withAuth(async () => {
  const backups = listBackups()
  return json({ backups, total: backups.length })
})

export const POST = withAuth(async ({ actor }) => {
  const result = runBackup()
  if (!result.success) {
    return json({ error: result.error }, { status: 500 })
  }
  return json({ success: true, backup: { file: result.file, size: result.size }, actor: actor.name })
})

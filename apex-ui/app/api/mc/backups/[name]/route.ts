/**
 * GET /api/mc/backups/:name — download backup file
 */

import { withAuth, json } from '@/lib/server/api-helpers'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DB_PATH = process.env.MC_DB_PATH || path.resolve(process.cwd(), '..', 'data', 'swarm_state.db')
const BACKUP_DIR = path.resolve(path.dirname(DB_PATH), 'backups')

export const GET = withAuth(async ({ req }) => {
  const name = req.nextUrl.pathname.split('/').pop()!
  // Validate filename to prevent path traversal
  if (!/^backup-\d{4}-\d{2}-\d{2}-\d{6}\.db$/.test(name) && !/^backup-.*\.db$/.test(name)) {
    // Allow slightly more permissive but still safe
    if (!/^[a-zA-Z0-9._-]+\.db$/.test(name) || name.includes('..') || name.includes('/')) {
      return json({ error: 'Invalid backup filename' }, { status: 400 })
    }
  }

  const fullPath = path.join(BACKUP_DIR, name)
  // Ensure file is inside backup dir (prevent traversal)
  if (!fullPath.startsWith(BACKUP_DIR)) {
    return json({ error: 'Invalid path' }, { status: 400 })
  }

  if (!fs.existsSync(fullPath)) {
    return json({ error: 'Backup not found' }, { status: 404 })
  }

  const stat = fs.statSync(fullPath)
  const data = fs.readFileSync(fullPath)

  return new Response(data, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(stat.size),
    },
  })
})

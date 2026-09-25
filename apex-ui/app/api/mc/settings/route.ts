/**
 * GET /api/mc/settings — list app_settings + derived config
 * PUT /api/mc/settings — upsert key-value settings (admin)
 */

import db from '@/lib/server/db'
import { withAuth, json, parseBody } from '@/lib/server/api-helpers'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UpdateSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]),
})

const BulkUpdateSchema = z.object({
  settings: z.array(UpdateSchema).min(1).max(50),
})

export const GET = withAuth(async () => {
  const settings = db.prepare(`SELECT key, value, updated_at FROM app_settings ORDER BY key`).all() as any[]
  const parsed: Record<string, any> = {}
  for (const s of settings) {
    try {
      parsed[s.key] = JSON.parse(s.value)
    } catch {
      parsed[s.key] = s.value
    }
  }

  // Agents count
  const agentsCount = (db.prepare(`SELECT COUNT(*) as c FROM agents`).get() as any).c

  // Backup files list
  let backups: { name: string; size: number; created_at: string }[] = []
  try {
    const backupDir = path.resolve(process.cwd(), '..', 'data', 'backups')
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort().reverse().slice(0, 20)
      backups = files.map(f => {
        const full = path.join(backupDir, f)
        const stat = fs.statSync(full)
        return { name: f, size: stat.size, created_at: stat.mtime.toISOString() }
      })
    }
  } catch {
    // ignore
  }

  // DB info
  const dbPath = process.env.MC_DB_PATH || path.resolve(process.cwd(), '..', 'data', 'swarm_state.db')
  let dbSize = 0
  try {
    if (fs.existsSync(dbPath)) {
      dbSize = fs.statSync(dbPath).size
    }
  } catch {}

  // Env info (non-secret)
  const envInfo = {
    node_env: process.env.NODE_ENV || 'development',
    db_path: dbPath,
    db_size_bytes: dbSize,
    backup_count: backups.length,
    agents_count: agentsCount,
    version: process.env.npm_package_version || '4.0.0',
  }

  return json({
    settings: parsed,
    raw: settings,
    backups,
    env: envInfo,
  })
})

export const PUT = withAuth(async ({ req, actor }) => {
  const body = await parseBody(req, BulkUpdateSchema)

  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (@key, @value, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = CURRENT_TIMESTAMP
  `)

  const tx = db.transaction(() => {
    for (const s of body.settings) {
      const val = typeof s.value === 'string' ? s.value : JSON.stringify(s.value)
      upsert.run({ key: s.key, value: val })
    }
  })
  tx()

  // Audit
  db.prepare(`
    INSERT INTO audit_log (actor, actor_type, action, target_type, target_id, result, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    actor.name,
    actor.type,
    'settings.update',
    'settings',
    'bulk',
    'success',
    JSON.stringify({ keys: body.settings.map(s => s.key) })
  )

  return json({ success: true, updated: body.settings.length })
})

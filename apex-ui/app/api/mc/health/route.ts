import db, { dbHealthy } from '@/lib/server/db'
import { config } from '@/lib/server/env'
import { publicHandler, json } from '@/lib/server/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getUptimeSeconds(): number {
  // process.uptime() adalah seconds sejak Node.js process start
  return Math.floor(process.uptime())
}

function getMemoryMB(): number {
  const mem = process.memoryUsage()
  return Math.round(mem.rss / (1024 * 1024))
}

function getQueueDepth(): number {
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM tasks WHERE status IN ('inbox', 'queued', 'running')`)
    .get() as { c: number }
  return row?.c ?? 0
}

function getActiveAgents(): number {
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM agents WHERE status IN ('online', 'working', 'idle') AND enabled = 1`)
    .get() as { c: number }
  return row?.c ?? 0
}

function getLastError(): string | null {
  const row = db
    .prepare(`SELECT created_at FROM system_logs WHERE level = 'error' ORDER BY created_at DESC LIMIT 1`)
    .get() as { created_at: string } | undefined
  return row?.created_at ?? null
}

function getWorkerLastTick(): string | null {
  const row = db
    .prepare(`SELECT value FROM app_settings WHERE key = 'worker_last_tick'`)
    .get() as { value: string } | undefined
  return row?.value ?? null
}

function getLastBackup(): string | null {
  try {
    const row = db.prepare(`SELECT value FROM app_settings WHERE key='last_backup'`).get() as { value: string } | undefined
    if (!row) return null
    const parsed = JSON.parse(row.value)
    return parsed.created_at || null
  } catch { return null }
}

function getCounts() {
  try {
    const tasks = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) as running
      FROM tasks
    `).get() as any
    const approvals = (db.prepare(`SELECT COUNT(*) as c FROM approvals WHERE status='pending'`).get() as any).c
    const costs = (db.prepare(`SELECT COALESCE(SUM(cost_usd),0) as c FROM cost_tracking WHERE recorded_at >= date('now')`).get() as any).c
    return { tasks, pending_approvals: approvals, cost_today: costs }
  } catch {
    return { tasks: { total: 0, done: 0, failed: 0, running: 0 }, pending_approvals: 0, cost_today: 0 }
  }
}

export const GET = publicHandler(async () => {
  const healthy = dbHealthy()
  const queueDepth = getQueueDepth()
  const activeAgents = getActiveAgents()
  const lastError = getLastError()
  const workerLastTick = getWorkerLastTick()
  const lastBackup = getLastBackup()
  const counts = getCounts()

  // Derive overall status
  let status: 'ok' | 'degraded' | 'down' = 'ok'
  if (!healthy) status = 'down'
  else if (queueDepth > 20 || (workerLastTick && Date.now() - new Date(workerLastTick).getTime() > 60000)) {
    status = 'degraded'
  }

  return json({
    status,
    version: config.appVersion,
    timestamp: new Date().toISOString(),
    startup_time: config.startupTime,
    uptime_seconds: getUptimeSeconds(),
    database: healthy ? 'connected' : 'error',
    memory_mb: getMemoryMB(),
    active_agents: activeAgents,
    queue_depth: queueDepth,
    last_error_at: lastError,
    worker_last_tick: workerLastTick,
    last_backup_at: lastBackup,
    tasks: counts.tasks,
    pending_approvals: counts.pending_approvals,
    cost_today_usd: counts.cost_today,
    env: process.env.NODE_ENV || 'development',
  })
})

export async function HEAD() {
  return new Response(null, { status: 200 })
}

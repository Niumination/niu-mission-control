/**
 * Bootstrap server saat aplikasi mulai.
 * Hanya dieksekusi di Node.js runtime, server-side saja.
 * TIDAK BOLEH di-import dari client components.
 */

export async function register() {
  const { default: db } = await import('./db')
  const { default: dispatcher } = await import('./dispatcher')
  const { logger, registerGlobalErrorHandlers } = await import('./logger')
  const { startBackupScheduler, stopBackupScheduler } = await import('./backup')

  // Register global error handlers (uncaughtException, unhandledRejection)
  registerGlobalErrorHandlers()

  void db // ensure import
  logger.info('DB initialized', { module: 'bootstrap' })

  // ── Recovery: reset stale running tasks & working agents saat startup ──
  try {
    const staleTasks = db.prepare(`
      SELECT id, assigned_agent, retry_count FROM tasks WHERE status = 'running'
    `).all() as Array<{ id: string; assigned_agent: string | null; retry_count: number }>
    if (staleTasks.length > 0) {
      logger.warn(`Recovering ${staleTasks.length} stale running task(s) from previous run`, { module: 'bootstrap', count: staleTasks.length })
      const now = new Date().toISOString()
      const updateTask = db.prepare(`
        UPDATE tasks SET status = 'queued', started_at = NULL, claimed_at = NULL,
               next_retry_at = ?, retry_count = retry_count + 1,
               error_message = 'Recovered from restart (worker interrupted)'
        WHERE id = ? AND status = 'running'
      `)
      const tx = db.transaction(() => {
        for (const t of staleTasks) updateTask.run(now, t.id)
        db.prepare(`UPDATE agents SET status = 'idle', current_task_id = NULL WHERE status = 'working'`).run()
      })
      tx()
      logger.info(`Recovered ${staleTasks.length} stale task(s) to queued after restart`, { module: 'bootstrap' })
    }
  } catch (e) {
    logger.error('Recovery error', { module: 'bootstrap', error: String(e) })
  }

  dispatcher.start()
  startBackupScheduler()
  logger.info('Niumination Mission Control started', { module: 'system' })

  // ── Graceful shutdown dengan timeout 30s ──
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`Received ${signal}, shutting down gracefully...`, { module: 'bootstrap', signal })

    try {
      stopBackupScheduler()
    } catch {}

    try {
      // Tunggu dispatcher selesai max 30s
      if (typeof (dispatcher as any).stopGracefully === 'function') {
        await (dispatcher as any).stopGracefully(30000)
      } else {
        dispatcher.stop()
      }
    } catch (e) {
      logger.error('Shutdown error in dispatcher', { module: 'bootstrap', error: String(e) })
    }

    try {
      // Close DB
      const dbModule = await import('./db')
      const dbInstance = dbModule.default as any
      if (dbInstance && typeof dbInstance.close === 'function') {
        dbInstance.close()
        logger.info('DB closed', { module: 'bootstrap' })
      }
    } catch (e) {
      logger.error('Error closing DB', { module: 'bootstrap', error: String(e) })
    }

    logger.info('Shutdown complete, exiting', { module: 'bootstrap', signal })
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

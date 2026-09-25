/**
 * Dispatcher Worker Loop
 * -----------------------
 * Jantung orkestrasi v4. Berjalan di server proses Next.js.
 *
 * Setiap POLL_INTERVAL_MS (3 detik), dispatcher:
 * 1. Bersihkan active runs yang sudah terminal (completed/failed/cancelled)
 *    → catat result/error/cost/artifacts ke DB → emit event
 * 2. Klaim (claim) 1 task dari queue yang sudah siap:
 *      - status='queued'
 *      - next_retry_at ≤ now (atau null)
 *      - tidak memiliki dependency yang belum selesai
 *      - agent yang dituju available (adapter ada, tidak sedang menangani run lain)
 * 3. Panggil adapter.send() → simpan run_id ke task
 * 4. Ubah status task menjadi 'running', set claimed_at/started_at
 *
 * Retry/backoff/dead-letter:
 * - Saat task gagal dan retry_count < max_retries, dispatcher set
 *   status kembali ke 'queued', naikkan retry_count, atur next_retry_at
 *   dengan exponential backoff.
 * - Saat retry_count ≥ max_retries, set status 'failed' permanen.
 *
 * Fungsi start() dipanggil saat server boot (dari Next.js server code
 * yang berjalan di sisi server saja). Fungsi stop() dipanggil saat
 * graceful shutdown.
 *
 * Lihat PRD §F4.
 */

import db from './db'
import { eventBus, emitTaskEvent, emitAgentEvent, emitSystemEvent } from './events'
import { calculateBackoffMs, CLAIMABLE_STATUSES, isTerminal } from './state-machine'
import { getAdapter, listAdapters, type AgentAdapter, type TaskRun, type RunArtifact, type TokenUsage } from './adapters'
import { writeSystemLog } from './logging'

const POLL_INTERVAL_MS = 3000       // Cek queue setiap 3 detik
const MAX_CONCURRENT_TASKS = 5       // Paralel maksimum 5 task sekaligus (sesuai 5 agent)
const EVENT_LOOP_WARN_MS = 500       // Warning jika satu tick loop melebihi ini

interface ActiveRun {
  run: TaskRun
  adapter: AgentAdapter
  taskId: string
  pollFailures: number
}

class Dispatcher {
  private timer: ReturnType<typeof setInterval> | null = null
  private activeRuns = new Map<string, ActiveRun>() // runId → ActiveRun
  private startedAt: string | null = null
  private tickCount = 0
  private lastTickAt: string | null = null

  /**
   * Mulai worker loop. Aman dipanggil berulang (idempotent).
   */
  start() {
    if (this.timer) return
    this.startedAt = new Date().toISOString()
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS)
    // Jalankan tick pertama segera (tanpa menunggu interval)
    setImmediate(() => this.tick())
    console.log('[dispatcher] Started, poll interval:', POLL_INTERVAL_MS, 'ms')
    try {
      const { logger } = require('./logger')
      logger.info('Dispatcher started', { module: 'dispatcher', poll_interval_ms: POLL_INTERVAL_MS, max_concurrent: MAX_CONCURRENT_TASKS })
    } catch {}
    emitSystemEvent('dispatcher.started', {
      poll_interval_ms: POLL_INTERVAL_MS,
      max_concurrent: MAX_CONCURRENT_TASKS,
      adapters: listAdapters(),
    })
  }

  /**
   * Hentikan worker loop (graceful shutdown).
   * - Stop timer (tidak claim task baru)
   * - Tunggu active runs selesai max 30s
   * - Jika masih ada yang running setelah timeout, tandai sebagai queued (interrupted)
   * - Tutup tidak membunuh proses hermes yang sedang berjalan (best-effort)
   */
  async stopGracefully(timeoutMs = 30000): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    const start = Date.now()
    // Tunggu active runs selesai dengan polling 500ms
    while (this.activeRuns.size > 0 && Date.now() - start < timeoutMs) {
      console.log(`[dispatcher] Waiting for ${this.activeRuns.size} active run(s) to finish... (${Math.round((Date.now() - start) / 1000)}s)`)
      await new Promise(r => setTimeout(r, 500))
      // Coba reap sekali lagi untuk mempercepat
      try { await this.reapActiveRuns() } catch {}
    }

    // Jika masih ada yang running setelah timeout, mark sebagai interrupted → queued
    if (this.activeRuns.size > 0) {
      console.warn(`[dispatcher] ${this.activeRuns.size} run(s) still active after ${timeoutMs}ms, marking as interrupted`)
      const now = new Date().toISOString()
      const tx = db.transaction(() => {
        for (const [runId, active] of this.activeRuns.entries()) {
          db.prepare(`
            UPDATE tasks SET status='queued', started_at=NULL, claimed_at=NULL,
                   error_message='Interrupted by shutdown (graceful timeout)', next_retry_at=?
            WHERE id=? AND status='running'
          `).run(now, active.taskId)
          db.prepare(`UPDATE agents SET status='idle', current_task_id=NULL WHERE id=?`).run(active.adapter ? (active as any).taskId ? active.taskId : active.run.agent_id : active.run.agent_id)
          // Best-effort cancel adapter run
          try { active.adapter.cancel(active.run) } catch {}
        }
      })
      try { tx() } catch (e) { console.error('[dispatcher] Failed to mark interrupted tasks:', e) }
      this.activeRuns.clear()
    }

    emitSystemEvent('dispatcher.stopped', { active_runs: this.activeRuns.size })
    console.log('[dispatcher] Stopped gracefully')
    try {
      const { logger } = require('./logger')
      logger.info('Dispatcher stopped gracefully', { module: 'dispatcher', active_runs: this.activeRuns.size })
    } catch {}
  }

  /**
   * Hentikan worker loop (legacy sync, untuk backward compat).
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    emitSystemEvent('dispatcher.stopped', { active_runs: this.activeRuns.size })
    console.log('[dispatcher] Stopped')
  }

  isRunning(): boolean {
    return this.timer !== null
  }

  getStatus() {
    return {
      running: this.timer !== null,
      started_at: this.startedAt,
      last_tick: this.lastTickAt,
      tick_count: this.tickCount,
      active_runs: this.activeRuns.size,
      queue_depth: this.getQueueDepth(),
    }
  }

  getQueueDepth(): number {
    const row = db
      .prepare(`SELECT COUNT(*) as c FROM tasks WHERE status IN ('inbox','queued')`)
      .get() as { c: number }
    return row?.c ?? 0
  }

  /**
   * Tick utama — dipanggil setiap POLL_INTERVAL_MS.
   * Public agar bisa dipanggil dari integration test secara deterministik.
   * Tidak boleh throw; semua error ditangani di dalam.
   */
  async tick() {
    const tickStart = Date.now()
    this.tickCount++
    this.lastTickAt = new Date().toISOString()

    // Update last tick timestamp di app_settings agar health endpoint melihat
    try {
      db.prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('worker_last_tick', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
      ).run(this.lastTickAt)
    } catch (e) {
      // Abaikan; jangan sampai health update gagal mematikan tick
    }

    try {
      // 1. Poll active runs & handle selesai
      await this.reapActiveRuns()

      // 2. Klaim task baru jika ada kapasitas
      while (this.activeRuns.size < MAX_CONCURRENT_TASKS) {
        const claimed = await this.claimAndDispatchOne()
        if (!claimed) break
      }
    } catch (err) {
      console.error('[dispatcher] Tick error:', err)
      writeSystemLog('error', `Dispatcher tick error: ${String(err).slice(0, 500)}`, 'dispatcher')
    }

    const tickDuration = Date.now() - tickStart
    if (tickDuration > EVENT_LOOP_WARN_MS) {
      console.warn(`[dispatcher] Tick took ${tickDuration}ms (> ${EVENT_LOOP_WARN_MS}ms)`)
    }
  }

  /**
   * Poll setiap run yang aktif dan handle yang sudah terminal.
   */
  private async reapActiveRuns() {
    const finished: string[] = []

    for (const [runId, active] of this.activeRuns.entries()) {
      try {
        const updated = await active.adapter.poll(active.run)
        active.run = updated

        if (updated.status === 'running' || updated.status === 'queued') {
          continue
        }
        if (updated.status === 'awaiting_approval') {
          // Buat record approval dan ubah task ke status review
          await this.handleApprovalRequest(active, updated)
          finished.push(runId)
          continue
        }
        if (updated.status === 'completed') {
          await this.handleCompleted(active, updated)
          finished.push(runId)
          continue
        }
        if (updated.status === 'failed') {
          await this.handleFailed(active, updated)
          finished.push(runId)
          continue
        }
        if (updated.status === 'cancelled') {
          finished.push(runId)
          continue
        }
      } catch (err) {
        // Poll error — retry beberapa kali sebelum menganggap gagal
        active.pollFailures++
        console.error(`[dispatcher] Poll error for run ${runId} (attempt ${active.pollFailures}):`, err)
        if (active.pollFailures >= 5) {
          await this.handleFailed(active, {
            ...active.run,
            status: 'failed',
            error: `Adapter poll failed after 5 attempts: ${String(err).slice(0, 500)}`,
            completed_at: new Date().toISOString(),
          })
          finished.push(runId)
        }
      }
    }

    for (const runId of finished) {
      this.activeRuns.delete(runId)
    }
  }

  /**
   * Cari task queued yang siap dijalankan, dispatch ke adapter.
   * Return true jika berhasil claim satu task.
   */
  private async claimAndDispatchOne(): Promise<boolean> {
    // Gunakan transaksi untuk claim atomic:
    // SELECT ... WHERE status='queued' AND next_retry_at <= now AND depends_on CLEAR
    // LIMIT 1 → UPDATE status='running', SET claimed_at ...
    // Tidak ada race condition karena SQLite single-writer.
    const now = new Date().toISOString()

    // Ambil kandidat task (yang queued, tidak menunggu retry, tidak ada dependency yang belum done)
    const candidate = db.prepare(`
      SELECT t.*
      FROM tasks t
      WHERE t.status IN (${CLAIMABLE_STATUSES.map(() => '?').join(',')})
        AND (t.next_retry_at IS NULL OR t.next_retry_at <= ?)
        AND t.assigned_agent IS NOT NULL
        AND (
          t.depends_on IS NULL
          OR EXISTS (SELECT 1 FROM tasks p WHERE p.id = t.depends_on AND p.status = 'done')
        )
        AND NOT EXISTS (
          SELECT 1 FROM tasks r WHERE r.assigned_agent = t.assigned_agent AND r.status = 'running'
        )
      ORDER BY
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END,
        t.created_at ASC
      LIMIT 1
    `).get(...CLAIMABLE_STATUSES, now) as any

    if (!candidate) return false

    const taskId = candidate.id as string
    const agentId = candidate.assigned_agent as string

    // Resolve adapter untuk agent
    const agentRow = db.prepare('SELECT adapter, enabled FROM agents WHERE id = ?').get(agentId) as any
    if (!agentRow || !agentRow.enabled) {
      // Agent tidak ditemukan/disabled; tandai task sebagai gagal
      this.markTaskFailed(taskId, `Agent '${agentId}' not found or disabled`)
      return true // sudah "handle" satu task, loop lanjut
    }
    const adapter = getAdapter(agentRow.adapter)
    if (!adapter) {
      this.markTaskFailed(taskId, `Adapter '${agentRow.adapter}' not registered`)
      return true
    }
    if (!adapter.isAvailable()) {
      // Adapter tidak tersedia saat ini; jangan claim, biarkan di queue
      // dan tunggu tick selanjutnya
      return false
    }

    // Dispatch
    let run: TaskRun
    try {
      run = await adapter.send({
        task_id: taskId,
        agent_id: agentId,
        instruction: candidate.instruction || candidate.title,
        model: candidate.metadata ? (() => { try { return JSON.parse(candidate.metadata).model } catch { return undefined } })() : undefined,
        priority: candidate.priority,
      })
    } catch (err) {
      this.markTaskFailed(taskId, `Adapter send error: ${String(err).slice(0, 500)}`)
      return true
    }

    // Update task ke running
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE tasks
        SET status = 'running',
            claimed_at = COALESCE(claimed_at, @now),
            started_at = @now,
            progress = 0,
            error_message = NULL
        WHERE id = @id
      `).run({ id: taskId, now })

      db.prepare(`UPDATE agents SET status = 'working', current_task_id = ?, last_seen = ? WHERE id = ?`)
        .run(taskId, now, agentId)
    })
    tx()

    this.activeRuns.set(run.run_id, { run, adapter, taskId, pollFailures: 0 })

    emitTaskEvent(taskId, 'task.claimed', { agent_id: agentId, run_id: run.run_id }, 'dispatcher')
    emitTaskEvent(taskId, 'task.started', { agent_id: agentId, run_id: run.run_id }, 'dispatcher')
    emitAgentEvent(agentId, 'agent.working', { task_id: taskId }, 'dispatcher')

    writeSystemLog('info', `Task ${taskId} claimed by ${adapter.name}:${agentId}`, 'dispatcher')
    return true
  }

  /**
   * Task completed: update status jadi review atau done (bergantung requires_approval),
   * simpan result/cost/artifacts.
   */
  private async handleCompleted(active: ActiveRun, run: TaskRun) {
    const { taskId } = active

    // Simpan artifacts
    if (run.artifacts) {
      this.saveArtifacts(taskId, run.agent_id, run.artifacts)
    }
    // Simpan cost
    if (run.token_usage) {
      this.recordCost(taskId, run.agent_id, run.token_usage)
    }

    // Tentukan status target: jika task membutuhkan approval (bukan dari adapter approval_request,
    // tapi dari requires_approval flag), masuk ke review. Saat ini hasil hermes biasa tidak
    // membutuhkan approval; hasil ke review hanya jika adapter set approval_request (yang akan
    // ditangani di handleApprovalRequest). Untuk sekarang, selesai langsung → done.
    // Catatan: jika task menghasilkan approval_request, itu ditangani sebelum completed.
    const targetStatus = 'done'
    const now = new Date().toISOString()

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE tasks
        SET status = @status,
            completed_at = @now,
            progress = 100,
            result = @result
        WHERE id = @id
      `).run({ id: taskId, status: targetStatus, now, result: run.result?.slice(0, 100000) ?? null })

      db.prepare(`UPDATE agents SET status = 'idle', current_task_id = NULL, last_seen = ? WHERE id = ?`)
        .run(now, run.agent_id)
    })
    tx()

    emitTaskEvent(taskId, 'task.completed', {
      agent_id: run.agent_id,
      run_id: run.run_id,
      cost_usd: run.token_usage?.cost_usd ?? null,
      result_preview: run.result?.slice(0, 200) ?? null,
    }, 'dispatcher')

    emitAgentEvent(run.agent_id, 'agent.idle', { last_task: taskId }, 'dispatcher')
    writeSystemLog('info', `Task ${taskId} completed by ${run.agent_id}`, 'dispatcher')
  }

  /**
   * Task gagal: cek retry, atau dead-letter.
   */
  private async handleFailed(active: ActiveRun, run: TaskRun) {
    const { taskId } = active
    const now = new Date().toISOString()

    const task = db.prepare('SELECT retry_count, max_retries FROM tasks WHERE id = ?').get(taskId) as any
    const retryCount: number = task?.retry_count ?? 0
    const maxRetries: number = task?.max_retries ?? 3

    if (retryCount < maxRetries) {
      // Retry: status kembali ke queued, naikkan retry_count, set next_retry_at
      const newRetryCount = retryCount + 1
      const backoffMs = calculateBackoffMs(newRetryCount)
      const nextRetryAt = new Date(Date.now() + backoffMs).toISOString()

      db.prepare(`
        UPDATE tasks
        SET status = 'queued',
            retry_count = @retry_count,
            next_retry_at = @next_retry,
            error_message = @error,
            progress = 0
        WHERE id = @id
      `).run({
        id: taskId,
        retry_count: newRetryCount,
        next_retry: nextRetryAt,
        error: run.error?.slice(0, 3000) ?? 'Unknown error',
      })

      emitTaskEvent(taskId, 'task.retrying', {
        retry_count: newRetryCount,
        max_retries: maxRetries,
        backoff_ms: backoffMs,
        error: run.error?.slice(0, 300) ?? null,
      }, 'dispatcher')

      writeSystemLog('warn', `Task ${taskId} failed (retry ${newRetryCount}/${maxRetries}, backoff ${Math.round(backoffMs/1000)}s): ${run.error?.slice(0, 200)}`, 'dispatcher')
    } else {
      // Dead-letter: permanen gagal
      db.prepare(`
        UPDATE tasks
        SET status = 'failed',
            failed_at = @now,
            error_message = @error
        WHERE id = @id
      `).run({ id: taskId, now, error: run.error?.slice(0, 3000) ?? 'Unknown error' })

      db.prepare(`UPDATE agents SET status = 'idle', current_task_id = NULL, last_seen = ? WHERE id = ?`)
        .run(now, run.agent_id)

      emitTaskEvent(taskId, 'task.failed', {
        agent_id: run.agent_id,
        retry_count: retryCount,
        error: run.error?.slice(0, 500) ?? null,
      }, 'dispatcher')
      emitAgentEvent(run.agent_id, 'agent.idle', { last_task: taskId }, 'dispatcher')

      // Emit alert
      emitSystemEvent('alert.raised', {
        severity: 'error',
        task_id: taskId,
        agent_id: run.agent_id,
        message: `Task ${taskId} permanently failed after ${maxRetries} retries`,
      })

      writeSystemLog('error', `Task ${taskId} permanently failed after ${maxRetries} retries: ${run.error?.slice(0, 200)}`, 'dispatcher')
    }
  }

  /**
   * Handle approval request dari adapter: buat record approvals, set task ke review.
   */
  private async handleApprovalRequest(active: ActiveRun, run: TaskRun) {
    const { taskId } = active
    if (!run.approval_request) return

    const approvalId = `apr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 jam

    db.prepare(`
      INSERT INTO approvals (id, task_id, action_type, payload, requested_by, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      approvalId,
      taskId,
      run.approval_request.action_type,
      JSON.stringify({ ...run.approval_request.payload, message: run.approval_request.message }),
      run.agent_id,
      now,
      expiresAt,
    )

    db.prepare(`UPDATE tasks SET status = 'review', submitted_at = ?, progress = 100 WHERE id = ?`)
      .run(now, taskId)

    emitTaskEvent(taskId, 'task.submitted', { agent_id: run.agent_id, approval_id: approvalId }, 'dispatcher')
    emitTaskEvent(taskId, 'approval.requested', {
      approval_id: approvalId,
      action_type: run.approval_request.action_type,
      payload: run.approval_request.payload,
      requested_by: run.agent_id,
    }, run.agent_id)

    emitSystemEvent('alert.raised', {
      severity: 'warning',
      task_id: taskId,
      approval_id: approvalId,
      message: `Approval needed for task ${taskId}: ${run.approval_request.message}`,
    })

    writeSystemLog('warn', `Task ${taskId} awaiting approval (${run.approval_request.action_type})`, 'dispatcher')
  }

  private markTaskFailed(taskId: string, error: string) {
    const now = new Date().toISOString()
    db.prepare(`UPDATE tasks SET status='failed', failed_at=?, error_message=? WHERE id=?`)
      .run(now, error, taskId)
    emitTaskEvent(taskId, 'task.failed', { error: error.slice(0, 300) }, 'dispatcher')
    writeSystemLog('error', `Task ${taskId} failed to dispatch: ${error}`, 'dispatcher')
  }

  private saveArtifacts(taskId: string, agentId: string, artifacts: RunArtifact[]) {
    const insert = db.prepare(`
      INSERT INTO artifacts (id, task_id, agent_id, type, path, name, content, mime_type, size_bytes, metadata)
      VALUES (@id, @task_id, @agent_id, @type, @path, @name, @content, @mime_type, @size_bytes, @metadata)
    `)
    const tx = db.transaction(() => {
      for (const a of artifacts) {
        insert.run({
          id: `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          task_id: taskId,
          agent_id: agentId,
          type: a.type,
          path: a.path ?? null,
          name: a.name,
          content: a.content ?? null,
          mime_type: a.mime_type ?? null,
          size_bytes: a.size_bytes ?? (a.content ? Buffer.byteLength(a.content, 'utf-8') : null),
          metadata: a.metadata ? JSON.stringify(a.metadata) : null,
        })
      }
    })
    tx()
  }

  private recordCost(taskId: string, agentId: string, usage: TokenUsage) {
    db.prepare(`
      INSERT INTO cost_tracking (task_id, agent_id, session_id, model, provider, input_tokens, output_tokens,
                                  cache_read_tokens, cache_write_tokens, cost_usd, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD')
    `).run(
      taskId,
      agentId,
      null,
      usage.model ?? null,
      usage.provider ?? null,
      usage.input_tokens ?? 0,
      usage.output_tokens ?? 0,
      usage.cache_read_tokens ?? 0,
      usage.cache_write_tokens ?? 0,
      usage.cost_usd ?? 0,
    )
  }
}

// Singleton
export const dispatcher: Dispatcher = (() => {
  const g = globalThis as unknown as { __mc_dispatcher__?: Dispatcher }
  if (!g.__mc_dispatcher__) {
    g.__mc_dispatcher__ = new Dispatcher()
  }
  return g.__mc_dispatcher__
})()
export default dispatcher

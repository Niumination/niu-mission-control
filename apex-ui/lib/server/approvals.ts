/**
 * Approval business logic — digunakan oleh route handlers dan bisa
 * dipakai oleh dispatcher (auto-approve, timeout) di masa depan.
 */

import db from './db'
import { emitTaskEvent, emitSystemEvent } from './events'
import { audit } from './auth'
import { ApiError } from './api-helpers'

export async function decideApproval(
  approvalId: string,
  decision: 'approved' | 'rejected',
  reason: string | null | undefined,
  actorName: string,
  actorType: 'user' | 'api_key' | 'system',
) {
  const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId) as any
  if (!approval) throw new ApiError(404, 'Approval not found')
  if (approval.status !== 'pending') throw new ApiError(409, `Approval already ${approval.status}`)

  const now = new Date().toISOString()
  const taskId = approval.task_id as string

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE approvals SET status = ?, decided_by = ?, decision_reason = ?, decided_at = ? WHERE id = ?`
    ).run(decision, actorName, reason ?? null, now, approvalId)

    if (decision === 'approved') {
      // Operator menyetujui: set task kembali ke queued agar dispatcher
      // mengeksekusi ulang (adapter akan resume di M10).
      db.prepare(
        `UPDATE tasks SET status = 'queued', next_retry_at = NULL, submitted_at = NULL WHERE id = ?`
      ).run(taskId)
    } else {
      db.prepare(
        `UPDATE tasks SET status = 'failed', failed_at = ?, error_message = ? WHERE id = ?`
      ).run(now, `Rejected by ${actorName}: ${reason ?? 'no reason'}`, taskId)
    }

    db.prepare(`UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ?`)
      .run(approval.requested_by)
  })
  tx()

  if (decision === 'approved') {
    emitTaskEvent(taskId, 'approval.approved', { approval_id: approvalId, decided_by: actorName }, actorName)
    emitTaskEvent(taskId, 'task.queued', { reason: 'approval granted' }, actorName)
  } else {
    emitTaskEvent(taskId, 'approval.rejected', { approval_id: approvalId, reason }, actorName)
    emitTaskEvent(taskId, 'task.failed', { reason: 'rejected', approval_id: approvalId }, actorName)
  }
  emitSystemEvent('alert.resolved', { task_id: taskId, approval_id: approvalId })

  audit(actorName, actorType, `approval.${decision}`, 'approval', approvalId, 'success', {
    task_id: taskId,
    reason: reason ?? null,
  })
}

export function listApprovals(status: string, limit: number) {
  const rows = db
    .prepare(
      `SELECT a.*, t.title as task_title, ag.name as agent_name
       FROM approvals a
       LEFT JOIN tasks t ON a.task_id = t.id
       LEFT JOIN agents ag ON a.requested_by = ag.id
       WHERE a.status = ?
       ORDER BY a.created_at DESC
       LIMIT ?`
    )
    .all(status, limit) as any[]
  for (const r of rows) {
    try { r.payload = JSON.parse(r.payload) } catch {}
  }
  return rows
}

/**
 * Cek approval yang sudah expired dan set jadi rejected otomatis.
 * Dipanggil dispatcher setiap menit (bisa ditambah di M9 alerting).
 */
export function expireOldApprovals(): number {
  const now = new Date().toISOString()
  const rows = db.prepare(
    `SELECT id FROM approvals WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?`
  ).all(now) as any[]
  for (const row of rows) {
    try {
      decideApproval(row.id, 'rejected', 'Auto-rejected: approval timed out', 'system', 'system')
    } catch (e) {
      console.error('[approvals] Failed to auto-expire approval', row.id, e)
    }
  }
  return rows.length
}

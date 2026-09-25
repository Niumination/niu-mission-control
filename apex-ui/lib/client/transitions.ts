'use client'

/**
 * Client-side mirror dari VALID_TRANSITIONS di lib/server/state-machine.ts.
 * Sinkron dengan definisi server. Tidak meng-import apapun dari lib/server
 * (untuk menghindari ter-tarik better-sqlite3 atau code Node-only ke client bundle).
 */

export type TaskStatus = 'inbox' | 'queued' | 'running' | 'review' | 'done' | 'failed' | 'cancelled'

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  inbox:     ['queued', 'cancelled'],
  queued:    ['running', 'cancelled'],
  running:   ['review', 'failed', 'cancelled'],
  review:    ['done', 'failed', 'cancelled', 'queued'],
  done:      [],
  failed:    ['queued', 'cancelled'],
  cancelled: [],
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

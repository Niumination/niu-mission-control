/**
 * Task State Machine
 * -----------------
 * Definisi status dan transisi yang valid.
 *
 * Lifecycle:
 *   inbox → queued → running → review → done
 *                 ↘           ↘ failed (dengan retry/backoff atau dead-letter)
 *                 → cancelled (dari manapun kecuali terminal states)
 *
 * Setiap transisi menentukan field timestamp mana yang harus di-set
 * dan event apa yang harus di-emit.
 *
 * Lihat PRD §F3.
 */

export type TaskStatus =
  | 'inbox'
  | 'queued'
  | 'running'
  | 'review'
  | 'done'
  | 'failed'
  | 'cancelled'

export const TERMINAL_STATES: ReadonlySet<TaskStatus> = new Set(['done', 'failed', 'cancelled'])

export function isTerminal(s: string): s is TaskStatus {
  return TERMINAL_STATES.has(s as TaskStatus)
}

/**
 * Map current status → array of allowed next statuses.
 * Transisi di luar map ini ditolak (ApiError 409).
 */
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  inbox:     ['queued', 'cancelled'],
  queued:    ['running', 'cancelled'],
  running:   ['review', 'failed', 'cancelled'],
  review:    ['done', 'failed', 'cancelled', 'queued'], // review bisa dikembalikan ke queued (rework)
  done:      [],
  failed:    ['queued', 'cancelled'], // retry = set ke queued lagi
  cancelled: [],
}

/**
 * Field timestamp yang perlu di-update saat pindah ke status tertentu.
 * Nilai adalah nama kolom di DB.
 */
export const STATUS_TIMESTAMPS: Partial<Record<TaskStatus, keyof TaskTimestamps>> = {
  queued:    'queued_at',
  running:   'started_at',
  review:    'submitted_at',
  done:      'completed_at',
  failed:    'failed_at',
}

export interface TaskTimestamps {
  queued_at?: string
  claimed_at?: string
  started_at?: string
  submitted_at?: string
  completed_at?: string
  failed_at?: string
}

/**
 * Validasi apakah transisi dari `from` ke `to` diizinkan.
 */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

/**
 * Menentukan status target yang harus diklaim oleh dispatcher.
 * (saat ini status 'queued' — yang sudah di-assign ke agent atau tidak).
 * Logika ini dipusatkan di sini agar M5/M10 bisa menambah logika
 * (misal: hanya klaim jika agent tidak sibuk, ada budget, dll.) tanpa
 * mengubah dispatcher.
 */
export const CLAIMABLE_STATUSES: TaskStatus[] = ['queued']
export const RUNNING_STATUSES: TaskStatus[] = ['running']

/**
 * Hitung backoff delay dalam milidetik berdasarkan retry_count.
 * Formula: 2^retry * 1000 ms, dengan jitter ±20%, cap di 60 detik.
 *
 * retry 0 → 2s  (1s-3s dengan jitter)
 * retry 1 → 4s
 * retry 2 → 8s
 * retry 3 → 16s
 * retry 4+ → 60s (cap)
 */
export function calculateBackoffMs(retryCount: number): number {
  const base = Math.min(Math.pow(2, Math.max(0, retryCount)) * 1000, 60_000)
  // ±20% jitter untuk menghindari thundering herd
  const jitter = base * 0.2 * (Math.random() * 2 - 1)
  return Math.round(base + jitter)
}

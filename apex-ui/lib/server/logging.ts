/**
 * Structured logging + system_logs DB writer.
 *
 * Di M11 kita akan ganti console.log dengan pino JSON logger.
 * Untuk M2, helper sederhana yang menulis ke DB + console sudah cukup.
 */

import db from './db'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function writeSystemLog(level: LogLevel, message: string, source?: string, taskId?: string, metadata?: Record<string, unknown>) {
  try {
    db.prepare(
      `INSERT INTO system_logs (level, message, source, task_id, metadata) VALUES (?, ?, ?, ?, ?)`
    ).run(
      level,
      message.slice(0, 5000),
      source ?? null,
      taskId ?? null,
      metadata ? JSON.stringify(metadata) : null,
    )
  } catch (e) {
    // Jangan biarkan logging failure mem-bunuh kode utama
    console.error('[logging] Failed to write system_log:', e)
  }

  // Juga output ke console dengan konteks
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  consoleMethod(`[${level}]${source ? ` [${source}]` : ''} ${message}`)
}

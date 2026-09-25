/**
 * Backup system — M11 polish
 * - VACUUM INTO untuk backup SQLite yang konsisten (tidak perlu lock manual)
 * - Retention 30 hari (hapus file lebih tua)
 * - Scheduler: cek setiap jam, backup jam 3 pagi, atau via manual trigger
 */

import fs from 'fs'
import path from 'path'
import db from './db'
import { logger } from './logger'

const DB_PATH = process.env.MC_DB_PATH || path.resolve(process.cwd(), '..', 'data', 'swarm_state.db')
const BACKUP_DIR = path.resolve(path.dirname(DB_PATH), 'backups')
const RETENTION_DAYS = 30

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    logger.info(`Backup dir created: ${BACKUP_DIR}`, { module: 'backup' })
  }
}

export function runBackup(): { success: boolean; file?: string; size?: number; error?: string } {
  try {
    ensureBackupDir()
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19) // YYYY-MM-DDTHH-MM-SS
    const datePart = now.toISOString().slice(0, 10) // YYYY-MM-DD
    const timePart = now.toISOString().slice(11, 19).replace(/:/g, '') // HHMMSS
    const backupFile = path.join(BACKUP_DIR, `backup-${datePart}-${timePart}.db`)

    // VACUUM INTO — SQLite 3.27+ feature, creates consistent snapshot
    // Lebih aman daripada copy file biasa saat WAL mode
    try {
      db.prepare(`VACUUM INTO ?`).run(backupFile)
    } catch (e) {
      // Fallback: copy file jika VACUUM INTO tidak tersedia (older SQLite)
      logger.warn(`VACUUM INTO failed, falling back to file copy: ${String(e)}`, { module: 'backup' })
      fs.copyFileSync(DB_PATH, backupFile)
    }

    const stat = fs.statSync(backupFile)
    logger.info(`Backup created: ${backupFile} (${(stat.size / 1024).toFixed(1)} KB)`, { module: 'backup', file: backupFile, size: stat.size })

    // Update app_settings dengan last backup info
    try {
      db.prepare(`
        INSERT INTO app_settings (key, value, updated_at) VALUES ('last_backup', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
      `).run(JSON.stringify({ file: backupFile, size: stat.size, created_at: now.toISOString() }))
    } catch {}

    // Retention cleanup
    cleanupOldBackups()

    return { success: true, file: backupFile, size: stat.size }
  } catch (err) {
    const msg = String(err)
    logger.error(`Backup failed: ${msg}`, { module: 'backup', error: msg })
    return { success: false, error: msg }
  }
}

export function cleanupOldBackups(): number {
  try {
    ensureBackupDir()
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup-') && f.endsWith('.db'))
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    let deleted = 0
    for (const f of files) {
      const full = path.join(BACKUP_DIR, f)
      try {
        const stat = fs.statSync(full)
        if (stat.mtime.getTime() < cutoff) {
          fs.unlinkSync(full)
          deleted++
          logger.info(`Deleted old backup: ${f}`, { module: 'backup', file: f })
        }
      } catch {}
    }
    if (deleted > 0) {
      logger.info(`Cleanup: deleted ${deleted} old backup(s) older than ${RETENTION_DAYS} days`, { module: 'backup', deleted })
    }
    return deleted
  } catch (err) {
    logger.error(`Cleanup failed: ${String(err)}`, { module: 'backup' })
    return 0
  }
}

export function listBackups(): { name: string; size: number; created_at: string }[] {
  try {
    ensureBackupDir()
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).sort().reverse()
    return files.slice(0, 50).map(f => {
      const full = path.join(BACKUP_DIR, f)
      const stat = fs.statSync(full)
      return { name: f, size: stat.size, created_at: stat.mtime.toISOString() }
    })
  } catch {
    return []
  }
}

// Scheduler — cek setiap jam, jika jam 3 pagi jalankan backup
let schedulerTimer: ReturnType<typeof setInterval> | null = null
let lastBackupDate: string | null = null

export function startBackupScheduler() {
  if (schedulerTimer) return
  // Cek setiap jam
  schedulerTimer = setInterval(() => {
    const now = new Date()
    const hour = now.getHours()
    const dateStr = now.toISOString().slice(0, 10)

    // Backup jam 3 pagi, dan hanya sekali per hari
    if (hour === 3 && lastBackupDate !== dateStr) {
      logger.info('Scheduled backup triggered (3 AM)', { module: 'backup' })
      runBackup()
      lastBackupDate = dateStr
    }
  }, 60 * 60 * 1000) // setiap jam

  // Juga cek saat startup apakah sudah lewat jam 3 hari ini dan belum backup
  const now = new Date()
  if (now.getHours() >= 3) {
    try {
      const lastBackupRow = db.prepare(`SELECT value FROM app_settings WHERE key='last_backup'`).get() as { value: string } | undefined
      if (lastBackupRow) {
        const parsed = JSON.parse(lastBackupRow.value)
        const lastDate = parsed.created_at ? parsed.created_at.slice(0, 10) : null
        const today = now.toISOString().slice(0, 10)
        if (lastDate !== today) {
          logger.info('No backup today yet, running initial backup check', { module: 'backup' })
          // Jangan langsung backup saat startup, tunggu 1 menit untuk hindari race dengan migration
          setTimeout(() => {
            const h = new Date().getHours()
            if (h >= 3) runBackup()
          }, 60 * 1000)
        }
      }
    } catch {}
  }

  logger.info('Backup scheduler started (daily 3 AM, retention 30d)', { module: 'backup' })
}

export function stopBackupScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
    logger.info('Backup scheduler stopped', { module: 'backup' })
  }
}

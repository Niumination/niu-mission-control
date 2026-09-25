/**
 * Structured JSON Logger — M11 polish
 * - Output JSON di production, pretty di development
 * - Setiap log punya timestamp, level, module, optional requestId, message, metadata
 * - Juga menulis ke system_logs DB untuk level info/warn/error (debug hanya console)
 * - Menangani uncaughtException & unhandledRejection
 */

import db from './db'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const CURRENT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
const IS_PROD = process.env.NODE_ENV === 'production'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[CURRENT_LEVEL]
}

interface LogContext {
  module?: string
  requestId?: string
  taskId?: string
  agentId?: string
  [key: string]: unknown
}

function formatConsole(level: LogLevel, message: string, ctx: LogContext) {
  const ts = new Date().toISOString()
  const mod = ctx.module ? `[${ctx.module}]` : ''
  const req = ctx.requestId ? `[req:${ctx.requestId}]` : ''
  const task = ctx.taskId ? `[task:${ctx.taskId}]` : ''
  const agent = ctx.agentId ? `[agent:${ctx.agentId}]` : ''

  if (IS_PROD) {
    // JSON output for production (easy to parse by log aggregator)
    const obj = {
      timestamp: ts,
      level,
      message,
      ...ctx,
    }
    return JSON.stringify(obj)
  } else {
    // Pretty for dev
    const extra = Object.entries(ctx)
      .filter(([k]) => !['module', 'requestId', 'taskId', 'agentId'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' ')
    return `${ts} ${level.toUpperCase().padEnd(5)} ${mod}${req}${task}${agent} ${message}${extra ? ' ' + extra : ''}`
  }
}

function writeToDb(level: LogLevel, message: string, ctx: LogContext) {
  if (level === 'debug') return // jangan penuhi DB dengan debug
  try {
    db.prepare(
      `INSERT INTO system_logs (level, message, source, task_id, metadata) VALUES (?, ?, ?, ?, ?)`
    ).run(
      level,
      message.slice(0, 5000),
      (ctx.module as string) || null,
      (ctx.taskId as string) || null,
      JSON.stringify({ ...ctx, message })
    )
  } catch {
    // jangan biarkan logging failure membunuh app
  }
}

function log(level: LogLevel, message: string, ctx: LogContext = {}) {
  if (!shouldLog(level)) return

  const consoleOutput = formatConsole(level, message, ctx)
  const method = level === 'error' ? console.error : level === 'warn' ? console.warn : level === 'debug' ? console.debug : console.log

  // In prod, output JSON; in dev, pretty
  method(consoleOutput)

  // Write to DB for persistence (except debug)
  writeToDb(level, message, ctx)
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => log('error', msg, ctx),

  // Compatibility with old writeSystemLog
  log: (level: LogLevel, msg: string, ctx?: LogContext) => log(level, msg, ctx),
}

// Legacy compatibility export
export function writeSystemLog(level: LogLevel, message: string, source?: string, taskId?: string, metadata?: Record<string, unknown>) {
  logger.log(level, message, { module: source, taskId, ...metadata })
}

// Global error handlers — call once at startup
let handlersRegistered = false
export function registerGlobalErrorHandlers() {
  if (handlersRegistered) return
  handlersRegistered = true

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { module: 'system', error: String(err), stack: (err as any)?.stack })
    // Jangan langsung exit, beri kesempatan graceful shutdown jika ada
    // Tapi untuk uncaughtException, sebaiknya exit setelah log
    setTimeout(() => process.exit(1), 1000)
  })

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { module: 'system', reason: String(reason), promise: String(promise) })
  })

  logger.info('Global error handlers registered', { module: 'system' })
}

/**
 * Environment validation — fail fast jika config wajib tidak tersedia.
 *
 * Prinsip: Jangan pernah diam-diam pakai default untuk secret atau config
 * krusial. Lebih baik crash saat startup daripada jalan dengan nilai yang
 * salah/bocor ke source control.
 */

import crypto from 'crypto'

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name]
  if (value && value.trim().length > 0) return value
  if (fallback !== undefined) return fallback
  throw new Error(
    `[env] Missing required environment variable: ${name}. ` +
    `Silakan set di .env.local atau environment.`
  )
}

function readOptionalEnv(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v : undefined
}

// ── Session / Auth ─────────────────────────────────────────────────

// SESSION_SECRET: jika tidak diset, generate random (berguna untuk dev;
// di production WAJIB diset agar session tahan restart).
function resolveSessionSecret(): string {
  const fromEnv = readOptionalEnv('MC_SESSION_SECRET')
  if (fromEnv) return fromEnv

  const generated = crypto.randomBytes(32).toString('hex')
  // Production fail harus saat runtime (saat request pertama bukan saat build)
  // agar next build tidak gagal. Kita set flag bahwa production membutuhkan
  // secret yang di-set.
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    // Delay throw sampai ini benar-benar dipanggil saat runtime, bukan saat build
  }
  if (process.env.NODE_ENV === 'production' && process.env.MC_SESSION_SECRET) {
    return process.env.MC_SESSION_SECRET
  }
  if (process.env.NODE_ENV === 'production' && !process.env.MC_SESSION_SECRET && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error(
      '[env] MC_SESSION_SECRET wajib di-set di production (32+ byte random hex). ' +
        `Generate dengan: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    )
  }
  if (process.env.NODE_ENV !== 'production' && !fromEnv) {
    console.warn('[env] MC_SESSION_SECRET tidak diset; menggunakan random value dev (session akan reset tiap restart).')
  }
  return generated
}

// MC_PASSWORD: digunakan saat first-run nanti.
// Jika tidak diset, app masuk mode SETUP_REQUIRED (tampilan halaman setup).
// Saat build phase (NEXT_PHASE=phase-production-build), kita set required: true
// tanpa throw agar build tidak gagal di CI sebelum env diisi.
function resolvePassword(): { required: boolean; hash?: string } {
  const hash = readOptionalEnv('MC_PASSWORD_HASH')
  if (hash) return { required: false, hash }
  return { required: true }
}

// MC_API_KEY: API key untuk akses programmatic (CLI, webhook, MCP).
// Jika tidak diset, app SETUP_REQUIRED atau generate di first-run script.
function resolveApiKey(): string | undefined {
  return readOptionalEnv('MC_API_KEY')
}

// ── Hermes CLI ─────────────────────────────────────────────────────

function resolveHermesCli(): string | undefined {
  return readOptionalEnv('HERMES_CLI')
}

function resolveTelegramChatId(): string | undefined {
  // TIDAK ADA fallback ke hardcoded chat ID seperti v3.
  // V3 yang menghardcode -1004204696417 adalah security leak.
  return readOptionalEnv('HERMES_TELEGRAM_CHAT_ID')
}

// ── Port & bind ────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10)
const BIND = process.env.MC_BIND || '127.0.0.1'

// ── Config object ──────────────────────────────────────────────────

export const config = {
  // Auth
  sessionSecret: resolveSessionSecret(),
  password: resolvePassword(),
  apiKey: resolveApiKey(),
  sessionCookieName: 'mc_session',
  sessionTtlSeconds: 7 * 24 * 3600, // 7 hari

  // Hermes / Telegram
  hermesCli: resolveHermesCli(),
  telegramChatId: resolveTelegramChatId(),

  // Network
  port: PORT,
  bind: BIND,

  // App
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  appVersion: process.env.MC_VERSION || '4.0.0-dev',
  startupTime: new Date().toISOString(),
}

export type AppConfig = typeof config

/**
 * Apakah app perlu setup halaman pertama kali?
 * True jika password dan api_key belum di-set.
 */
export function isSetupRequired(): boolean {
  return config.password.required && !config.apiKey
}

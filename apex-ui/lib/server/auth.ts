/**
 * Authentication & session management.
 *
 * v4.0 single-user:
 * - Password disimpan sebagai scrypt hash di env MC_PASSWORD_HASH
 * - Session via iron-session (encrypted cookie, httpOnly, sameSite=strict)
 * - API key via X-API-Key header (untuk CLI, webhook, MCP)
 *
 * Tidak ada "dev mode tanpa auth" — auth selalu on.
 */

import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { config, isSetupRequired } from './env'

// ── Types ──────────────────────────────────────────────────────────

export interface SessionData {
  loggedIn?: boolean
  loggedInAt?: string
  ip?: string
}

// ── Iron session options ───────────────────────────────────────────

const sessionOptions: SessionOptions = {
  password: config.sessionSecret,
  cookieName: config.sessionCookieName,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
    maxAge: config.sessionTtlSeconds,
  },
}

// ── Server-side session helper ────────────────────────────────────

export async function getSession() {
  return await getIronSession<SessionData>(await cookies(), sessionOptions)
}

// ── Password hashing (scrypt, native crypto) ───────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      // Format scrypt:<salt>:<key> — pakai ':' sebagai separator agar
      // Next.js dotenv tidak mengekspansinya sebagai env variable substitution
      // (dotenv expand akan treat '$VAR' sebagai referensi env var).
      else resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Support separator $ (legacy) atau : (baru, aman dari dotenv expansion).
  const sep = hash.includes('$') ? '$' : ':'
  const parts = hash.split(sep)
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, keyHex] = parts
  return new Promise((resolve) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false)
      try {
        const key = Buffer.from(keyHex, 'hex')
        resolve(crypto.timingSafeEqual(derivedKey, key))
      } catch {
        resolve(false)
      }
    })
  })
}

export function generateApiKey(): string {
  // Format: mc_<32 byte hex> = 67 char string
  return `mc_${crypto.randomBytes(32).toString('hex')}`
}

// ── Request auth helpers ───────────────────────────────────────────

type AuthResult =
  | { ok: true; actor: { type: 'user' | 'api_key'; name: string } }
  | { ok: false; status: number; message: string }

const API_KEY_SCHEME = 'Bearer '

export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  // Setup mode: belum ada password/api key, hanya boleh akses /api/auth/setup
  // (Middleware yang memblokir, ini hanya dipanggil di route yang butuh auth).

  // 1. Check API key (X-API-Key header)
  const apiKey = req.headers.get('x-api-key')
  if (apiKey && config.apiKey) {
    // timing-safe compare
    const a = Buffer.from(apiKey)
    const b = Buffer.from(config.apiKey)
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, actor: { type: 'api_key', name: 'api' } }
    }
    return { ok: false, status: 401, message: 'Invalid API key' }
  }

  // 2. Check Authorization: Bearer <api_key>
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith(API_KEY_SCHEME) && config.apiKey) {
    const token = authHeader.slice(API_KEY_SCHEME.length)
    const a = Buffer.from(token)
    const b = Buffer.from(config.apiKey)
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, actor: { type: 'api_key', name: 'api' } }
    }
    return { ok: false, status: 401, message: 'Invalid API key' }
  }

  // 3. Check session cookie (user login via browser)
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
    if (session.loggedIn) {
      return { ok: true, actor: { type: 'user', name: 'operator' } }
    }
  } catch {
    // Session invalid / belum ada
  }

  return { ok: false, status: 401, message: 'Authentication required' }
}

// ── Audit helper ───────────────────────────────────────────────────

import db from './db'

export function audit(
  actor: string,
        actorType: 'user' | 'agent' | 'system' | 'api_key',
  action: string,
  targetType: string,
  targetId: string,
  result: 'success' | 'failure' | 'rejected',
  details?: Record<string, unknown>,
  clientIp?: string,
  userAgent?: string,
) {
  try {
    db.prepare(
      `INSERT INTO audit_log (actor, actor_type, action, target_type, target_id, result, details, client_ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      actor,
      actorType,
      action,
      targetType,
      targetId,
      result,
      details ? JSON.stringify(details) : null,
      clientIp || null,
      userAgent || null,
    )
  } catch (e) {
    // Jangan sampai audit gagal memblokir aksi utama
    console.error('[audit] Failed to write audit log:', e)
  }
}

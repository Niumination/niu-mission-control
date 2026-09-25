/**
 * Next.js Middleware — auth + setup redirect.
 *
 * - Semua request ke /api/mc/* dan halaman aplikasi (kecuali /login, /api/auth/*,
 *   /setup, asset statis) membutuhkan auth.
 * - Jika password/API key belum di-set (setup required), redirect ke /setup.
 * - Request dari CLI dengan X-API-Key lolos tanpa session.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Catatan: middleware berjalan di Edge Runtime (bisa juga Node, tapi default edge).
// JANGAN mengimpor modul yang menggunakan Node.js native (fs/crypto/child_process)
// dari file ini. Kita baca setup flag langsung dari process.env di sini.
function isSetupRequired(): boolean {
  // Password sudah di-set jika MC_PASSWORD_HASH ada (non-empty).
  // Ini adalah cek yang aman di edge runtime tanpa perlu import env.ts.
  const hash = process.env.MC_PASSWORD_HASH
  return !hash || hash.trim().length === 0
}

// Path yang boleh diakses tanpa auth
const PUBLIC_PATHS = new Set([
  '/login',
  '/setup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/setup',
  '/api/mc/health', // health public, tanpa sensitive info
  '/api/weather',
  '/api/debug',
])

// Path yang selalu diizinkan (static assets, favicon, dll.)
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/public']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  for (const p of PUBLIC_PREFIXES) {
    if (pathname.startsWith(p)) return true
  }
  return false
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Izinkan path publik
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 2. Setup mode: jika belum ada password, hanya boleh akses /setup dan /api/auth/setup
  if (isSetupRequired()) {
    if (pathname === '/setup' || pathname === '/api/auth/setup') {
      return NextResponse.next()
    }
    const url = req.nextUrl.clone()
    url.pathname = '/setup'
    return NextResponse.redirect(url)
  }

  // 3. API key (X-API-Key atau Authorization Bearer)
  const apiKey = req.headers.get('x-api-key')
  const authHeader = req.headers.get('authorization')
  const expectedApiKey = process.env.MC_API_KEY
  if (expectedApiKey) {
    if (apiKey && timingSageEqual(apiKey, expectedApiKey)) {
      return NextResponse.next()
    }
    if (authHeader?.startsWith('Bearer ') && timingSageEqual(authHeader.slice(7), expectedApiKey)) {
      return NextResponse.next()
    }
  }

  // 4. Check session cookie (nama cookie dari iron-session).
  // Iron-session cookie adalah signed & encrypted; di sini kita hanya cek
  // keberadaan cookie. Validasi isi dilakukan di route handler dengan
  // getSession(). Middleware tidak bisa decrypt iron-session dengan mudah
  // karena edge runtime; cukup tolak yang tidak punya cookie ke /login.
  const sessionCookie = req.cookies.get('mc_session')

  const isApiRoute = pathname.startsWith('/api/')
  if (!sessionCookie) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // 5. Auth lolos
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except untuk static file yang memang public.
     * Pola dari Next.js docs.
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*).*)',
  ],
}

// timingSafeEqual tidak tersedia di edge runtime secara langsung; tapi
// middleware berjalan di node runtime untuk konfigurasi kita.
// Gunakan comparison yang constant-time sederhana.
function timingSageEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

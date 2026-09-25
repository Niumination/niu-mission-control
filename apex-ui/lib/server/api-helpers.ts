/**
 * Helper untuk Route Handlers API — pola standar:
 * 1. Autentikasi (kecuali route ditandai public)
 * 2. Parsing body/query dengan Zod schema
 * 3. Error handling yang konsisten (ZodError → 400, unknown → 500)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ZodError, ZodType, z } from 'zod'
import { authenticateRequest } from './auth'
import { formatZodError } from './schema'

export interface RouteContext {
  actor: { type: 'user' | 'api_key'; name: string }
  req: NextRequest
}

type Handler<T> = (ctx: RouteContext) => Promise<T>

/**
 * Wrapper untuk GET/POST/PATCH/DELETE handler yang membutuhkan auth.
 */
export function withAuth<T>(handler: Handler<T>) {
  return async (req: NextRequest) => {
    try {
      const auth = await authenticateRequest(req)
      if (!auth.ok) {
        return NextResponse.json({ error: auth.message }, { status: auth.status })
      }
      return await handler({ req, actor: auth.actor })
    } catch (err) {
      return handleError(err)
    }
  }
}

/**
 * Wrapper untuk public handler (tidak perlu auth) seperti health.
 */
export function publicHandler<T>(handler: (req: NextRequest) => Promise<T>) {
  return async (req: NextRequest) => {
    try {
      return await handler(req)
    } catch (err) {
      return handleError(err)
    }
  }
}

/**
 * Parse JSON body dan validasi dengan Zod schema.
 * Throw ApiError 400 jika invalid.
 */
export async function parseBody<T extends ZodType>(
  req: NextRequest,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  try {
    return schema.parse(raw)
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError(400, 'Validation failed', formatZodError(err))
    }
    throw err
  }
}

/**
 * Parse query string dengan Zod schema (nilai dari URLSearchParams adalah string,
 * schema sebaiknya memakai z.coerce untuk angka).
 */
export function parseQuery<T extends ZodType>(
  req: NextRequest,
  schema: T,
): z.infer<T> {
  const obj = Object.fromEntries(req.nextUrl.searchParams.entries())
  try {
    return schema.parse(obj)
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError(400, 'Invalid query parameters', formatZodError(err))
    }
    throw err
  }
}

/**
 * Error yang bisa dilempar dari handler untuk langsung menghasilkan
 * HTTP response dengan status tertentu.
 */
export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function handleError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, details: err.details },
      { status: err.status },
    )
  }
  console.error('[api] Unhandled error:', err)
  const message = err instanceof Error ? err.message : String(err)
  return NextResponse.json(
    { error: 'Internal server error', message: message.slice(0, 500) },
    { status: 500 },
  )
}

export const json = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, init)

/**
 * POST /api/mc/telegram/send
 *
 * Kirim pesan ke Telegram via Hermes CLI.
 * MENGGUNAKAN EXECFILE ASYNC (bukan execSync) dan TIDAK memiliki hardcoded chat ID.
 * Chat ID diambil dari env HERMES_TELEGRAM_CHAT_ID (wajib).
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { withAuth, json, parseBody, ApiError } from '@/lib/server/api-helpers'
import { TelegramSendSchema } from '@/lib/server/schema'
import { audit } from '@/lib/server/auth'
import { config } from '@/lib/server/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const execFileAsync = promisify(execFile)

export const POST = withAuth(async ({ actor, req }) => {
  // Env check — fail fast jika Hermes atau chat ID belum diset
  if (!config.hermesCli) {
    throw new ApiError(503, 'HERMES_CLI not configured')
  }
  if (!config.telegramChatId) {
    throw new ApiError(503, 'HERMES_TELEGRAM_CHAT_ID not configured')
  }

  const body = await parseBody(req, TelegramSendSchema)
  const target = `telegram:${config.telegramChatId}:${body.topic_id}`

  let stdout = ''
  try {
    const result = await execFileAsync(
      config.hermesCli,
      ['send', '-t', target, body.message],
      { timeout: 30_000, maxBuffer: 1024 * 1024, shell: false }
    )
    stdout = result.stdout
  } catch (err: any) {
    if (err.killed || err.code === 'ETIMEDOUT') {
      throw new ApiError(504, 'Hermes send timed out (30s)')
    }
    const stderr = err.stderr || err.message || String(err)
    throw new ApiError(502, `Hermes send failed: ${stderr.slice(0, 300)}`)
  }

  const sent = stdout.toLowerCase().includes('sent')
  audit(
    actor.name,
    actor.type as 'user' | 'api_key',
    'telegram.send',
    'telegram',
    body.topic_id,
    sent ? 'success' : 'failure',
    { target, topic_id: body.topic_id, message_length: body.message.length }
  )

  if (!sent) {
    return json({ status: 'error', message: stdout.slice(0, 200) }, { status: 502 })
  }

  return json({ status: 'sent', message: 'Pesan terkirim ke Telegram' })
})

#!/usr/bin/env node
/**
 * scripts/hash-password.mjs <password>
 *
 * Generate scrypt hash dari password untuk MC_PASSWORD_HASH.
 * Usage:
 *   node apex-ui/scripts/hash-password.mjs "passwordku"
 */
import crypto from 'crypto'

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>')
  console.error('Password must be at least 6 characters.')
  process.exit(1)
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters.')
  process.exit(1)
}

const salt = crypto.randomBytes(16).toString('hex')
crypto.scrypt(password, salt, 64, (err, derivedKey) => {
  if (err) {
    console.error('Error hashing password:', err)
    process.exit(1)
  }
  const hash = `scrypt$${salt}$${derivedKey.toString('hex')}`
  console.log('\nCopy nilai ini ke MC_PASSWORD_HASH di .env.local:\n')
  console.log(`MC_PASSWORD_HASH=${hash}\n`)
})

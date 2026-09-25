#!/usr/bin/env node
/**
 * scripts/generate-api-key.mjs
 *
 * Generate random API key untuk MC_API_KEY.
 */
import crypto from 'crypto'

const key = `mc_${crypto.randomBytes(32).toString('hex')}`
console.log('\nCopy nilai ini ke MC_API_KEY di .env.local:\n')
console.log(`MC_API_KEY=${key}\n`)
console.log(`Panjang: ${key.length} karakter.\n`)

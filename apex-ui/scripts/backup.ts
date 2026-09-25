/**
 * CLI backup script — manual backup trigger
 * Usage: npx tsx scripts/backup.ts  OR  node --loader tsx scripts/backup.ts
 * For production, compiled via: npm run build, then node scripts/backup.js
 */

import path from 'path'

// For tsx / ts-node compatibility, we need to handle both ESM and CJS
async function main() {
  // Dynamic import to handle path resolution
  const dbPath = path.resolve(process.cwd(), 'lib/server/db')
  const backupPath = path.resolve(process.cwd(), 'lib/server/backup')

  // We are in apex-ui/scripts, so cwd is apex-ui
  const { runBackup, listBackups } = await import('../lib/server/backup')

  console.log('[backup] Starting manual backup...')
  const result = runBackup()
  if (result.success) {
    console.log(`[backup] ✅ Success: ${result.file} (${result.size} bytes)`)
  } else {
    console.error(`[backup] ❌ Failed: ${result.error}`)
    process.exit(1)
  }

  console.log('\n[backup] Recent backups:')
  const list = listBackups().slice(0, 10)
  for (const b of list) {
    console.log(`  - ${b.name} (${(b.size / 1024).toFixed(1)} KB) ${b.created_at}`)
  }
}

main().catch(err => {
  console.error('[backup] Unhandled error:', err)
  process.exit(1)
})

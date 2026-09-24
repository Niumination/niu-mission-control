import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

// Repo root = dua level di atas apex-ui (cwd saat `next start`/`next dev` = apex-ui)
const ROOT_DIR = path.resolve(process.cwd(), '..', '..')
const DB_MANAGER = path.join(ROOT_DIR, 'db_manager.py')
const DB_PATH = path.join(ROOT_DIR, 'data', 'swarm_state.db')

console.log('[MC] DB_MANAGER:', DB_MANAGER, '- exists:', existsSync(DB_MANAGER))
console.log('[MC] DB_PATH:', DB_PATH, '- exists:', existsSync(DB_PATH))

function runDBQuery(query: string, params: any[] = []): any {
  const env = { ...process.env, MC_DB_PATH: DB_PATH }
  const args = [DB_MANAGER, query, ...params.map(p => JSON.stringify(p))]
  try {
    const output = execSync(`python3 ${args.join(' ')}`, { 
      timeout: 5000,
      encoding: 'utf-8',
      env
    })
    return JSON.parse(output.trim())
  } catch (error) {
    console.error('[MC] DB Query error:', error instanceof Error ? error.message : error)
    return null
  }
}

export async function GET() {
  try {
    const dbExists = existsSync(DB_PATH)
    const dbTest = dbExists ? runDBQuery('test_db') : false
    
    console.log('[MC] Health check - dbExists:', dbExists, 'dbTest:', dbTest)
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbTest ? 'connected' : (dbExists ? 'error' : 'missing'),
      version: '2.0.0',
      uptime: process.uptime()
    }
    
    return NextResponse.json(health)
  } catch (error) {
    console.error('[MC] Health error:', error)
    return NextResponse.json(
      { status: 'error', details: String(error) },
      { status: 500 }
    )
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

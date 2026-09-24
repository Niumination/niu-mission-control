import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const ROOT_DIR = path.resolve(process.cwd(), '..', '..')
const DB_MANAGER = `${ROOT_DIR}/db_manager.py`
const DB_PATH = `${ROOT_DIR}/data/swarm_state.db`

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
    const agents = runDBQuery('get_agents')
    if (agents) {
      return NextResponse.json({ agents, total: agents.length })
    }
    
    // Fallback static data
    const fallback = [
      { key: 'chief', name: 'Hermes Chief', role: 'Orchestrator & Leader', status: 'online', color: '#00e5ff' },
      { key: 'research', name: 'Research', role: 'Research & Learn', status: 'online', color: '#00e5ff' },
      { key: 'programmer', name: 'Programmer', role: 'Programmer & Coder', status: 'online', color: '#f5a623' },
      { key: 'qa', name: 'QA Tester', role: 'Tester & QA', status: 'online', color: '#34d399' },
      { key: 'creator', name: 'Kreator', role: 'Content Creator', status: 'online', color: '#f5a623' },
    ]
    return NextResponse.json({ agents: fallback, total: fallback.length })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get agents', details: String(error) },
      { status: 500 }
    )
  }
}

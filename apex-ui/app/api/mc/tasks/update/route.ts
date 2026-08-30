import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

const ROOT_DIR = '/Users/zaryu/Desktop/Niumination/services/niu-mission-control'
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('id')
    const status = searchParams.get('status')
    
    if (taskId && status) {
      const result = runDBQuery('update_task_status', [taskId, status])
      if (result) {
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
    
    return NextResponse.json({ error: 'Task ID and status required' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update task', details: String(error) },
      { status: 500 }
    )
  }
}

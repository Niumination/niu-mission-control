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
    const status = searchParams.get('status')
    
    let tasks
    if (status) {
      tasks = runDBQuery('get_tasks', [status])
    } else {
      tasks = runDBQuery('get_task_groups')
    }
    
    if (tasks) {
      return NextResponse.json(tasks)
    }
    
    return NextResponse.json({ pending: [], running: [], completed: [], failed: [] })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get tasks', details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, agent, priority = 'medium', description } = body
    
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    
    const taskId = runDBQuery('create_task', [title, agent, priority, description])
    
    if (taskId) {
      return NextResponse.json({ id: taskId, status: 'created' })
    }
    
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create task', details: String(error) },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(process.cwd(), '..', '..')
const DB_MANAGER = `${ROOT_DIR}/db_manager.py`;
const DB_PATH = `${ROOT_DIR}/data/swarm_state.db`;

function runDBQuery(query: string, params: any[] = []): any {
  const env = { ...process.env, MC_DB_PATH: DB_PATH };
  const args = [DB_MANAGER, query, ...params.map(p => JSON.stringify(p))];
  try {
    const output = execSync(`python3 ${args.join(' ')}`, {
      timeout: 5000,
      encoding: 'utf-8',
      env
    });
    return JSON.parse(output.trim());
  } catch (error) {
    console.error('[MC] DB Query error:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { task_id, status, result } = body;

    if (!task_id || !status) {
      return NextResponse.json({ error: 'task_id dan status wajib diisi' }, { status: 400 });
    }

    const success = runDBQuery('update_task_status', [task_id, status, result || null]);
    if (success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update task', details: String(error) },
      { status: 500 }
    );
  }
}

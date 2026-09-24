import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(process.cwd(), '..')
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const dispatches = runDBQuery('get_dispatches', [Math.max(1, Math.min(limit, 100))]);
    return NextResponse.json({ dispatches: dispatches || [] });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get dispatches', details: String(error) },
      { status: 500 }
    );
  }
}

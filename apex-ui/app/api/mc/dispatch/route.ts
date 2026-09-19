import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const ROOT_DIR = '/Users/zaryu/Desktop/Niumination/services/niu-mission-control';
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

// Agent-to-topic mapping (matches Hermes channel overrides)
const TOPIC_MAP: Record<string, string> = {
  'chief': '1',
  'research': '802',
  'programmer': '803',
  'qa': '804',
  'creator': '1172',
};

// Validate target topic
function validateTarget(to: string): [boolean, string] {
  const validTopics = ['1', '802', '803', '804', '1172'];
  if (!validTopics.includes(to)) {
    return [false, `Invalid target. Must be one of: ${validTopics.join(', ')}`];
  }
  return [true, ''];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, message, source } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message wajib diisi' }, { status: 400 });
    }

    const [ok, err] = validateTarget(to);
    if (!ok) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    // 1. Record pending dispatch
    const record = runDBQuery('add_dispatch', [to, message, source || 'general']);
    if (!record) {
      return NextResponse.json({ error: 'Failed to create dispatch record' }, { status: 500 });
    }

    // 2. Send to Telegram via hermes CLI (async — don't block response)
    // The actual send is handled by the frontend via the bridge or can be done here
    // For now, we return the record and let the frontend poll for status updates

    return NextResponse.json({
      id: record.id,
      status: 'pending',
      target: to,
      message: message.slice(0, 100),
      created_at: record.created_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to dispatch', details: String(error) },
      { status: 500 }
    );
  }
}

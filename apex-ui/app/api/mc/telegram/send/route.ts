import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const HERMES_CLI = process.env.HERMES_CLI || '/usr/local/bin/hermes'
const CHAT_ID = process.env.HERMES_TELEGRAM_CHAT_ID || '-1004204696417';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, topic_id = '1' } = body;

    if (!message) {
      return NextResponse.json({ error: 'message wajib diisi' }, { status: 400 });
    }

    const target = `telegram:${CHAT_ID}:${topic_id}`;

    try {
      const { stdout } = await execFileAsync(
        HERMES_CLI,
        ['send', '-t', target, message],
        { timeout: 30_000, maxBuffer: 1024 * 1024 }
      );

      if (stdout.toLowerCase().includes('sent')) {
        return NextResponse.json({ status: 'sent', message: 'Pesan terkirim ke Telegram' });
      }
      return NextResponse.json({ status: 'error', message: stdout.slice(0, 200) }, { status: 500 });
    } catch (error: any) {
      if (error.killed || error.code === 'TIMEOUT') {
        return NextResponse.json({ status: 'error', message: 'Timeout 30s' }, { status: 500 });
      }
      return NextResponse.json(
        { status: 'error', message: String(error.message || error).slice(0, 200) },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send telegram message', details: String(error) },
      { status: 500 }
    );
  }
}

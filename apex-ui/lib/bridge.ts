/**
 * Hermes Bridge — Niu-MissionControl ke Hermes Gateway (TypeScript)
 * =================================================================
 *
 * Reimplementasi logika dari modules/hermes_bridge.py yang hilang.
 * Menyediakan fungsi:
 * - sendChat: Kirim pesan ke Telegram via `hermes send` CLI
 * - runTerminal: Jalankan perintah shell read-only (allowlist)
 * - runAgentTurn: Trigger agent turn via `hermes -z --resume`
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const HERMES_CLI = process.env.HERMES_CLI || '/usr/local/bin/hermes'
const TELEGRAM_CHAT_ID = process.env.HERMES_TELEGRAM_CHAT_ID || '-1004204696417';
const TOPIC_PREFIX = 'thread:';

// ── Telegram ────────────────────────────────────────────────

export async function sendChat(
  text: string,
  topicId: string = '1',
): Promise<{ status: string; message: string; simulated?: boolean }> {
  if (!text) {
    return { status: 'error', message: 'Pesan kosong' };
  }

  const target = `telegram:${TELEGRAM_CHAT_ID}:${topicId}`;

  try {
    const { stdout } = await execFileAsync(
      HERMES_CLI,
      ['send', '-t', target, text],
      { timeout: 30_000, maxBuffer: 1024 * 1024 }
    );
    if (stdout.toLowerCase().includes('sent')) {
      return { status: 'sent', message: 'Pesan terkirim ke Telegram' };
    }
    return { status: 'error', message: stdout.slice(0, 200) };
  } catch (error: any) {
    if (error.killed || error.code === 'TIMEOUT') {
      return { status: 'error', message: 'Timeout 30s' };
    }
    return { status: 'error', message: String(error.message || error).slice(0, 200) };
  }
}

// ── Terminal (allowlist only) ───────────────────────────────

const ALLOWED_COMMANDS = new Set([
  'ls', 'pwd', 'echo', 'grep', 'find', 'head', 'tail',
  'ps', 'wc', 'date', 'uptime', 'df', 'du', 'whoami', 'env'
]);

const DANGEROUS_PATTERNS = ['|', ';', '&&', '||', '>', '<', '`', '(', '{', '\\', "'"];

export async function runTerminal(
  cmd: string,
  timeout: number = 15
): Promise<{ status: string; output: string; exit_code?: number }> {
  if (!cmd) {
    return { status: 'error', output: 'Perintah kosong' };
  }

  const firstWord = cmd.split(/\s+/)[0] || '';
  if (!ALLOWED_COMMANDS.has(firstWord)) {
    return {
      status: 'error',
      output: `Command blocked: '${firstWord}' not in safe allowlist`,
      exit_code: -1
    };
  }

  for (const pat of DANGEROUS_PATTERNS) {
    if (cmd.includes(pat)) {
      return {
        status: 'error',
        output: `Command blocked: '${pat}' pattern not allowed`,
        exit_code: -1
      };
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(cmd.split(/\s+/)[0], cmd.split(/\s+/).slice(1), {
      timeout: timeout * 1000,
      maxBuffer: 1024 * 1024,
      shell: false,
    });
    const output = stdout + (stderr ? `\n${stderr}` : '');
    return { status: 'ok', output: output.slice(0, 3000), exit_code: 0 };
  } catch (error: any) {
    if (error.killed || error.code === 'TIMEOUT') {
      return { status: 'error', output: `Timeout (${timeout}s)`, exit_code: -1 };
    }
    return {
      status: 'error',
      output: String(error.stderr || error.message || error).slice(0, 3000),
      exit_code: error.code || 1
    };
  }
}

// ── Agent Turn ──────────────────────────────────────────────

export async function runAgentTurn(
  prompt: string,
  sessionId: string,
  model?: string,
  provider?: string,
  timeout: number = 300
): Promise<{ status: string; output?: string; message?: string }> {
  const args = ['-z', prompt, '--resume', sessionId];
  if (model && provider) {
    args.push('-m', model, '--provider', provider);
  }
  args.push('--pass-session-id');

  try {
    const { stdout } = await execFileAsync(HERMES_CLI, args, {
      timeout: timeout * 1000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { status: 'done', output: stdout.trim().slice(0, 4000) };
  } catch (error: any) {
    if (error.killed || error.code === 'TIMEOUT') {
      return { status: 'error', message: `Timeout (${timeout}s)` };
    }
    return {
      status: 'error',
      message: String(error.stderr || error.message || error).slice(0, 300)
    };
  }
}

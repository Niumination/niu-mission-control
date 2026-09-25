/**
 * HermesCLIAdapter
 * ----------------
 * Adapter untuk Hermes CLI asli. Berkomunikasi dengan hermes via:
 *   - `hermes -z <prompt> --resume <session_id> [options]`
 * untuk mengirim instruksi dan mendapatkan output.
 *
 * Catatan penting:
 * - Implementasi awal di M2 ini adalah versi "fire-and-observe" yang
 *   mengeksekusi hermes secara sinkron (execFile dengan timeout) dan
 *   mengembalikan hasil saat proses selesai.
 * - Nanti di M10 (Live Ops) kita akan tingkatkan agar bisa dijalankan
 *   secara background dan output di-stream secara bertahap ke SSE.
 * - Session ID per agent disimpan di konfigurasi agent (adapter_config JSON)
 *   atau dibuat baru saat pertama kali dijalankan.
 *
 * Keamanan:
 * - SELALU gunakan execFile dengan shell:false
 * - Argumen di-push sebagai array, tidak pernah digabung ke string shell
 * - Timeout wajib di-set untuk mencegah proses menggantung
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import fs from 'fs'
import db from '../db'
import { config } from '../env'
import type { AgentAdapter, DispatchInstruction, TaskRun, RunArtifact, TokenUsage } from './index'

const execFileAsync = promisify(execFile)

const DEFAULT_TIMEOUT_SEC = 300 // 5 menit per task
const MAX_BUFFER = 8 * 1024 * 1024 // 8MB

interface HermesRun extends TaskRun {
  _process?: {
    stdout: string
    stderr: string
    exit_code: number | null
    killed: boolean
  }
}

export class HermesCLIAdapter implements AgentAdapter {
  readonly name = 'hermes'

  private activeRuns = new Map<string, HermesRun>()

  isAvailable(): boolean {
    const cliPath = config.hermesCli
    if (!cliPath) return false
    try {
      return fs.existsSync(cliPath)
    } catch {
      return false
    }
  }

  unavailableReason(): string | undefined {
    if (!config.hermesCli) return 'HERMES_CLI not configured'
    if (!this.isAvailable()) return `Hermes binary not found at ${config.hermesCli}`
    return undefined
  }

  async send(instruction: DispatchInstruction): Promise<TaskRun> {
    if (!this.isAvailable()) {
      throw new Error(`Hermes CLI not available: ${this.unavailableReason()}`)
    }

    const runId = `hermes_${crypto.randomBytes(8).toString('hex')}`
    const now = new Date().toISOString()

    // Resolve session_id dari adapter_config agent
    const agentRow = db.prepare('SELECT adapter_config FROM agents WHERE id = ?').get(instruction.agent_id) as any
    let sessionId: string | undefined
    if (agentRow?.adapter_config) {
      try {
        const cfg = JSON.parse(agentRow.adapter_config)
        sessionId = cfg.session_id
      } catch {
        // ignore parse error
      }
    }

    // Bangun argumen ke hermes
    const args: string[] = ['-z', instruction.instruction]
    if (sessionId) {
      args.push('--resume', sessionId)
    }

    const run: HermesRun = {
      run_id: runId,
      task_id: instruction.task_id,
      agent_id: instruction.agent_id,
      status: 'running',
      started_at: now,
      _process: { stdout: '', stderr: '', exit_code: null, killed: false },
    }

    // Jalankan secara asynchronous (tidak blocking send())
    // Polling akan cek hasilnya
    this.executeRun(run, args, instruction).catch(err => {
      // Tangkap exception yang tidak terduga
      run.status = 'failed'
      run.error = `Adapter internal error: ${String(err).slice(0, 500)}`
      run.completed_at = new Date().toISOString()
      this.activeRuns.delete(runId)
    })

    this.activeRuns.set(runId, run)
    return this.stripPrivate(run)
  }

  private async executeRun(run: HermesRun, args: string[], instruction: DispatchInstruction) {
    try {
      const timeoutSec = DEFAULT_TIMEOUT_SEC * 1000
      const { stdout, stderr } = await execFileAsync(config.hermesCli!, args, {
        timeout: timeoutSec,
        maxBuffer: MAX_BUFFER,
        shell: false,
        env: { ...process.env },
      })
      run._process!.stdout = stdout
      run._process!.stderr = stderr
      run._process!.exit_code = 0
      run._process!.killed = false

      // Cari sinyal "sent"/"completed" di output (sesuai dengan yang
      // kita tahu dari bridge.ts lama). Output aktual dianggap sebagai result.
      const out = stdout ?? ''
      const err = stderr ?? ''

      // Coba ekstrak token usage dari output (format hermes bisa beragam,
      // kita parse dengan regex yang longgar).
      const tokenUsage = this.tryExtractTokens(out)

      if (err && err.trim().length > 0) {
        // Jika ada stderr tapi bukan "error fatal", kita catat sebagai warning;
        // jika mengandung kata kunci error, anggap gagal.
        const errLower = err.toLowerCase()
        if (
          errLower.includes('error') &&
          !errLower.includes('warning') &&
          !errLower.includes('deprecat')
        ) {
          run.status = 'failed'
          run.error = err.slice(0, 3000)
          run.completed_at = new Date().toISOString()
          this.activeRuns.delete(run.run_id)
          return
        }
      }

      run.status = 'completed'
      run.result = out.slice(0, 100000) || '(no output)'
      run.token_usage = tokenUsage
      run.artifacts = [
        {
          type: 'log',
          name: 'hermes-stderr.log',
          content: err,
          mime_type: 'text/plain',
          size_bytes: Buffer.byteLength(err, 'utf-8'),
        },
      ]
      run.completed_at = new Date().toISOString()
    } catch (err: any) {
      if (err.killed || err.code === 'ETIMEDOUT') {
        run.status = 'failed'
        run.error = `Hermes timed out after ${DEFAULT_TIMEOUT_SEC}s`
      } else {
        run.status = 'failed'
        run.error = String(err.stderr || err.message || err).slice(0, 3000)
      }
      run.completed_at = new Date().toISOString()
      if (run._process) {
        run._process.killed = !!err.killed
        run._process.exit_code = err.code || 1
      }
    }
    this.activeRuns.delete(run.run_id)
  }

  async poll(run: TaskRun): Promise<TaskRun> {
    const active = this.activeRuns.get(run.run_id)
    if (!active) {
      // Run sudah selesai atau sudah dipoll sebelumnya.
      // Jika run dari awal sudah terminal (completed/failed), kembalikan apa adanya.
      return run
    }
    return this.stripPrivate(active)
  }

  async cancel(run: TaskRun): Promise<void> {
    // Hermes CLI tidak punya mekanisme cancel yang mudah tanpa PID tracking.
    // Di M2 kita hapus dari activeRuns; proses anak tidak bisa kita bunuh
    // tanpa child process reference (execFile tidak memberikan kita ChildProcess).
    // Catat ini sebagai tech debt untuk M10 ketika kita beralih ke spawn()
    // yang memberikan kontrol kill.
    this.activeRuns.delete(run.run_id)
  }

  private stripPrivate(r: HermesRun): TaskRun {
    const { _process, ...rest } = r
    void _process
    return rest
  }

  /**
   * Coba parse token usage dari stdout hermes. Berbagai format mungkin muncul
   * tergantung versi hermes; kita tangkap yang paling umum.
   */
  private tryExtractTokens(stdout: string): TokenUsage | undefined {
    // Format: "Tokens: 1234 in, 567 out" atau "Usage: input=123, output=456"
    // atau "$1.2345" atau "cost: $0.05"
    let inputTokens = 0
    let outputTokens = 0
    let costUsd: number | undefined

    const inMatch = stdout.match(/(?:input|prompt)[^\d]{0,15}(\d+)/i)
    const outMatch = stdout.match(/(?:output|completion|response)[^\d]{0,15}(\d+)/i)
    const costMatch = stdout.match(/\$?([\d]+\.[\d]{2,6})/m)

    if (inMatch) inputTokens = parseInt(inMatch[1], 10)
    if (outMatch) outputTokens = parseInt(outMatch[1], 10)
    if (costMatch) costUsd = parseFloat(costMatch[1])

    if (!inputTokens && !outputTokens && costUsd === undefined) return undefined

    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      model: undefined,
      provider: 'hermes',
    }
  }
}

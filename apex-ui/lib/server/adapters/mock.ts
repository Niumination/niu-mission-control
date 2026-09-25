/**
 * MockAdapter
 * -----------
 * Adapter untuk development dan testing. Mensimulasikan kerja agent
 * dengan delay random, random output, probabilitas gagal yang bisa
 * dikonfigurasi, dan (opsional) simulasi approval request.
 *
 * Mengaktifkannya: set MC_USE_MOCK_ADAPTER=1 atau agent config
 * adapter='mock'. Berguna saat mengembangkan UI/orchestration
 * tanpa harus menjalankan Hermes CLI.
 */

import crypto from 'crypto'
import type { AgentAdapter, DispatchInstruction, TaskRun, TokenUsage, RunArtifact } from './index'

export interface MockAdapterOptions {
  /** Rata-rata durasi kerja (detik). Default 8. */
  avgDurationSec?: number
  /** Probabilitas gagal (0-1). Default 0.15 (15%). */
  failRate?: number
  /** Probabilitas menghasilkan approval request (0-1). Default 0. */
  approvalRate?: number
}

interface ActiveRun extends TaskRun {
  _deadline: number
  _producesApproval: boolean
  _willFail: boolean
}

export class MockAdapter implements AgentAdapter {
  readonly name = 'mock'
  private activeRuns = new Map<string, ActiveRun>()
  private options: Required<MockAdapterOptions>

  constructor(options: MockAdapterOptions = {}) {
    this.options = {
      avgDurationSec: options.avgDurationSec ?? 8,
      failRate: options.failRate ?? 0.15,
      approvalRate: options.approvalRate ?? 0,
    }
  }

  isAvailable(): boolean {
    return true
  }

  async send(instruction: DispatchInstruction): Promise<TaskRun> {
    const runId = `mock_${crypto.randomBytes(8).toString('hex')}`
    const durationMs = this.options.avgDurationSec * 1000 * (0.5 + Math.random()) // 50-150% of avg
    const willFail = Math.random() < this.options.failRate
    const producesApproval = !willFail && Math.random() < this.options.approvalRate

    const now = Date.now()
    const run: ActiveRun = {
      run_id: runId,
      task_id: instruction.task_id,
      agent_id: instruction.agent_id,
      status: 'running',
      started_at: new Date(now).toISOString(),
      _deadline: now + durationMs,
      _producesApproval: producesApproval,
      _willFail: willFail,
    }
    this.activeRuns.set(runId, run)
    return this.stripPrivate(run)
  }

  async poll(run: TaskRun): Promise<TaskRun> {
    const active = this.activeRuns.get(run.run_id)
    if (!active) {
      return { ...run, status: 'failed', error: 'Run not found in mock adapter' }
    }

    const now = Date.now()

    // Pertama kalinya poll setelah mengirim approval request:
    if (active._producesApproval && !active.approval_request && now > active._deadline * 0.5) {
      active.status = 'awaiting_approval'
      active.approval_request = {
        action_type: 'shell_exec',
        message: 'Agent meminta izin menjalankan perintah simulasi.',
        payload: {
          command: 'echo "hello world"',
          cwd: '/tmp',
          simulated: true,
          task_id: run.task_id,
        },
      }
      return this.stripPrivate(active)
    }

    // Jika menunggu approval, status tetap
    if (active.status === 'awaiting_approval') {
      return this.stripPrivate(active)
    }

    // Jika belum deadline
    if (now < active._deadline) {
      // Update progress sederhana: 0-100 berdasarkan waktu
      const elapsed = now - new Date(active.started_at).getTime()
      const total = active._deadline - new Date(active.started_at).getTime()
      const progress = Math.min(99, Math.round((elapsed / total) * 100))
      // Note: progress di task di-update lewat event terpisah (bukan tanggung jawab adapter)
      return this.stripPrivate(active)
    }

    // Selesai
    if (active._willFail) {
      active.status = 'failed'
      active.error = [
        'Simulated failure: model timeout',
        'Simulated failure: dependency resolution error',
        'Simulated failure: command returned non-zero exit code',
        'Simulated failure: LLM hallucination detected',
      ][Math.floor(Math.random() * 4)]
      active.completed_at = new Date(now).toISOString()
    } else {
      active.status = 'completed'
      active.result = [
        `[Mock:${run.agent_id}] Tugas "${run.task_id}" selesai.`,
        '',
        'Instruksi yang diterima:',
        '```',
        (run as ActiveRun & { instruction?: string }) as any,
        '```',
        '',
        'Output: tugas simulasi berhasil dijalankan. Ini adalah hasil dari MockAdapter. Gunakan adapter Hermes untuk hasil nyata.',
      ].join('\n')
      active.completed_at = new Date(now).toISOString()
      active.artifacts = this.mockArtifacts(run.task_id, run.agent_id)
      active.token_usage = this.mockTokenUsage()
    }
    this.activeRuns.delete(run.run_id)
    return this.stripPrivate(active)
  }

  async cancel(run: TaskRun): Promise<void> {
    this.activeRuns.delete(run.run_id)
  }

  private stripPrivate(r: ActiveRun): TaskRun {
    const { _deadline, _producesApproval, _willFail, ...rest } = r
    void _deadline; void _producesApproval; void _willFail
    return rest
  }

  private mockArtifacts(taskId: string, agentId: string): RunArtifact[] {
    return [
      {
        type: 'text',
        name: `summary-${taskId}.md`,
        content: `# Hasil Task ${taskId}\n\nDieksekusi oleh agent ${agentId} via MockAdapter.\n\nHasil ini simulasi.`,
        mime_type: 'text/markdown',
        size_bytes: 128,
      },
    ]
  }

  private mockTokenUsage(): TokenUsage {
    return {
      input_tokens: Math.floor(500 + Math.random() * 2000),
      output_tokens: Math.floor(200 + Math.random() * 1500),
      cache_read_tokens: Math.floor(Math.random() * 300),
      model: 'mock-model',
      provider: 'mock',
      cost_usd: Math.round((0.005 + Math.random() * 0.05) * 10000) / 10000,
    }
  }
}

/**
 * Agent Adapter Interface & Registry
 * -----------------------------------
 * Adapter adalah lapisan abstraksi antara dispatcher dan runtime agent
 * (Hermes CLI, Claude Code, Codex, Mock untuk dev).
 *
 * Setiap runtime meng-implement interface AgentAdapter; dispatcher
 * berinteraksi dengan interface saja sehingga menambah runtime baru
 * tidak mengubah orchestration code.
 *
 * Lihat PRD §F5.
 */

import { HermesCLIAdapter } from './hermes'
import { MockAdapter } from './mock'

export interface TaskRun {
  run_id: string
  task_id: string
  agent_id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'awaiting_approval'
  started_at: string
  completed_at?: string
  result?: string
  error?: string
  artifacts?: RunArtifact[]
  token_usage?: TokenUsage
  approval_request?: ApprovalRequest
}

export interface RunArtifact {
  type: 'file' | 'diff' | 'text' | 'image' | 'url' | 'log'
  name: string
  path?: string
  content?: string
  mime_type?: string
  size_bytes?: number
  metadata?: Record<string, unknown>
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_read_tokens?: number
  cache_write_tokens?: number
  model?: string
  provider?: string
  cost_usd?: number
}

export interface ApprovalRequest {
  action_type: 'shell_exec' | 'external_send' | 'deploy' | 'file_delete' | 'db_mutation'
  payload: Record<string, unknown>
  message: string
}

export interface DispatchInstruction {
  task_id: string
  agent_id: string
  instruction: string
  model?: string
  priority?: 'high' | 'medium' | 'low'
  metadata?: Record<string, unknown>
}

/**
 * Semua adapter harus meng-implement ini.
 * Method `send` memulai eksekusi dan mengembalikan `run_id`.
 * Method `poll` dipanggil periodik oleh dispatcher sampai terminal state.
 * Method `cancel` membatalkan run (best-effort).
 */
export interface AgentAdapter {
  /** Identifier unik adapter (e.g. 'hermes', 'mock', 'claude-code'). */
  readonly name: string

  /** Apakah adapter saat ini tersedia (binary ada, config lengkap)? */
  isAvailable(): boolean

  /** Alasan mengapa adapter unavailable (untuk error message). */
  unavailableReason?(): string | undefined

  /** Kirim instruksi ke agent; return run_id unik. */
  send(instruction: DispatchInstruction): Promise<TaskRun>

  /**
   * Cek status run yang sedang berjalan. Dipanggil setiap POLL_INTERVAL_MS.
   * Jika run sudah selesai (completed/failed), kembalikan result/error/artifacts.
   */
  poll(run: TaskRun): Promise<TaskRun>

  /** Batalkan run yang sedang berjalan (best-effort). */
  cancel(run: TaskRun): Promise<void>
}

// ── Registry ──────────────────────────────────────────────────────

const adapters = new Map<string, AgentAdapter>()

export function registerAdapter(adapter: AgentAdapter) {
  adapters.set(adapter.name, adapter)
}

export function getAdapter(name: string): AgentAdapter | undefined {
  return adapters.get(name)
}

export function listAdapters(): Array<{ name: string; available: boolean; reason?: string }> {
  return Array.from(adapters.values()).map(a => ({
    name: a.name,
    available: a.isAvailable(),
    reason: a.unavailableReason?.(),
  }))
}

// ── Bootstrap: register default adapters ─────────────────────────

registerAdapter(new HermesCLIAdapter())
registerAdapter(new MockAdapter())

// Ekspor adapter classes untuk testing/dependency injection
export { HermesCLIAdapter } from './hermes'
export { MockAdapter } from './mock'

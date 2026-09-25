/**
 * Zod schemas untuk validasi semua input yang masuk ke API.
 *
 * Setiap Route Handler yang menerima body/params harus mem-parse
 * dengan schema yang sesuai. Input yang invalid langsung return 400
 * dan tidak pernah menyentuh DB.
 */

import { z } from 'zod'

// ── Primitive helpers ──────────────────────────────────────────────

export const TaskIdSchema = z.string().regex(/^t[a-z0-9]+$/, 'Invalid task ID format')
export const AgentIdSchema = z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, 'Invalid agent ID')
export const DispatchIdSchema = z.string().regex(/^d[a-f0-9]{12}$/, 'Invalid dispatch ID format')
export const ApprovalIdSchema = z.string().min(1).max(64)

export const TaskStatusSchema = z.enum([
  'inbox',
  'queued',
  'running',
  'review',
  'done',
  'failed',
  'cancelled',
])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const PrioritySchema = z.enum(['high', 'medium', 'low'])
export const AgentStatusSchema = z.enum(['online', 'idle', 'working', 'offline', 'error'])

// ── Tasks ──────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long (max 500)'),
  description: z.string().max(10000).optional().nullable(),
  instruction: z.string().max(50000).optional().nullable(),
  agent: AgentIdSchema.optional().nullable(),   // assigned_agent
  priority: PrioritySchema.default('medium'),
  source: z.enum(['manual', 'telegram', 'webhook', 'schedule', 'api']).default('manual'),
  depends_on: TaskIdSchema.optional().nullable(),
  idempotency_key: z.string().max(128).optional(),
  deadline_at: z.string().datetime().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>

export const UpdateTaskSchema = z.object({
  status: TaskStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional().nullable(),
  progress: z.number().int().min(0).max(100).optional(),
  result: z.string().max(100000).optional().nullable(),
  error_message: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>

export const ListTasksQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  agent: AgentIdSchema.optional(),
  priority: PrioritySchema.optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

// ── Agents ─────────────────────────────────────────────────────────

export const CreateAgentSchema = z.object({
  id: AgentIdSchema,
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').default('#00e5ff'),
  model_default: z.string().max(100).optional(),
  adapter: z.string().min(1).max(50).default('hermes'),
  system_prompt: z.string().max(50000).optional().nullable(),
})

export const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  model_default: z.string().max(100).optional(),
  system_prompt: z.string().max(50000).optional().nullable(),
  enabled: z.coerce.boolean().optional(),
  status: AgentStatusSchema.optional(),
})

// ── Dispatch ───────────────────────────────────────────────────────

export const TelegramTopicSchema = z.enum(['1', '802', '803', '804', '1172'])

export const CreateDispatchSchema = z.object({
  to: TelegramTopicSchema,
  message: z.string().min(1).max(10000, 'Message too long (max 10k chars)'),
  source: z.string().max(100).default('general'),
  idempotency_key: z.string().max(128).optional(),
})

export const TelegramSendSchema = z.object({
  message: z.string().min(1).max(10000),
  topic_id: TelegramTopicSchema.default('1'),
})

// ── Approvals ──────────────────────────────────────────────────────

export const ApprovalDecisionSchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
})

export const CreateApprovalSchema = z.object({
  task_id: TaskIdSchema,
  action_type: z.enum(['shell_exec', 'external_send', 'deploy', 'file_delete', 'db_mutation']),
  payload: z.record(z.string(), z.unknown()),
  requested_by: z.string().min(1).max(100),
  expires_in_ms: z.number().int().min(60000).max(86400000).default(3600000), // 1 menit - 24 jam, default 1 jam
})

// ── Auth ───────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  password: z.string().min(1, 'Password required'),
})

// ── Generic helpers ────────────────────────────────────────────────

/** Helper untuk parse query string dengan schema (semua nilai dari query adalah string, jadi coerce). */
export function parseQuery<T extends z.ZodTypeAny>(
  schema: T,
  params: URLSearchParams | Record<string, string | undefined>,
): z.infer<T> {
  const obj: Record<string, unknown> = {}
  const source = params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params
  for (const [k, v] of Object.entries(source)) {
    if (v !== undefined) obj[k] = v
  }
  return schema.parse(obj)
}

/**
 * Format Zod error menjadi struktur yang mudah dikonsumsi client.
 */
export function formatZodError(error: z.ZodError) {
  return error.issues.map(i => ({
    field: i.path.join('.'),
    message: i.message,
  }))
}

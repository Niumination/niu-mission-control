import { describe, it, expect } from 'vitest'
import { TaskIdSchema, AgentIdSchema, CreateTaskSchema } from './schema'

describe('schema', () => {
  it('TaskId valid', () => {
    expect(TaskIdSchema.safeParse('tmuh97uny448d14').success).toBe(true)
    expect(TaskIdSchema.safeParse('t123abc').success).toBe(true)
  })
  it('TaskId invalid', () => {
    expect(TaskIdSchema.safeParse('invalid').success).toBe(false)
    expect(TaskIdSchema.safeParse('').success).toBe(false)
  })
  it('AgentId valid', () => {
    expect(AgentIdSchema.safeParse('chief').success).toBe(true)
    expect(AgentIdSchema.safeParse('research').success).toBe(true)
  })
  it('CreateTask valid', () => {
    const r = CreateTaskSchema.safeParse({ title: 'Test task', priority: 'high' })
    expect(r.success).toBe(true)
  })
  it('CreateTask invalid empty title', () => {
    const r = CreateTaskSchema.safeParse({ title: '', priority: 'high' })
    expect(r.success).toBe(false)
  })
})

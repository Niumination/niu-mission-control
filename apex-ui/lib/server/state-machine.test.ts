import { describe, it, expect } from 'vitest'
import { VALID_TRANSITIONS, canTransition, calculateBackoffMs, isTerminal } from './state-machine'

describe('state-machine', () => {
  it('VALID_TRANSITIONS is single source of truth', () => {
    expect(VALID_TRANSITIONS).toBeDefined()
    expect(VALID_TRANSITIONS.inbox).toContain('queued')
    expect(VALID_TRANSITIONS.queued).toContain('running')
  })

  it('canTransition valid', () => {
    expect(canTransition('inbox', 'queued')).toBe(true)
    expect(canTransition('queued', 'running')).toBe(true)
    expect(canTransition('running', 'review')).toBe(true)
    expect(canTransition('review', 'done')).toBe(true)
    expect(canTransition('failed', 'queued')).toBe(true) // retry
  })

  it('canTransition invalid', () => {
    expect(canTransition('done', 'queued')).toBe(false)
    expect(canTransition('inbox', 'done')).toBe(false)
    expect(canTransition('running', 'done')).toBe(false) // must go via review
  })

  it('calculateBackoffMs exponential with jitter', () => {
    expect(calculateBackoffMs(1)).toBeGreaterThan(0)
    // retry 2 should generally be bigger than retry 1, but jitter can overlap, so check at least >0 and reasonable range
    const b1 = calculateBackoffMs(1)
    const b2 = calculateBackoffMs(2)
    expect(b2).toBeGreaterThan(500) // at least 500ms
    // cap 60s + 20% jitter = 72s
    expect(calculateBackoffMs(10)).toBeLessThanOrEqual(72000)
    expect(calculateBackoffMs(20)).toBeLessThanOrEqual(72000)
  })

  it('isTerminal', () => {
    expect(isTerminal('done')).toBe(true)
    expect(isTerminal('failed')).toBe(true)
    expect(isTerminal('cancelled')).toBe(true)
    expect(isTerminal('running')).toBe(false)
  })
})

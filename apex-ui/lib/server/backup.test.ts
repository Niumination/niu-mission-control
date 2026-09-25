import { describe, it, expect } from 'vitest'

describe('backup filename validation', () => {
  const valid = [
    'backup-2026-09-25-170317.db',
    'backup-2026-09-26-123456.db',
    'my-backup.db',
  ]
  const invalid = [
    '../etc/passwd',
    '../../backup.db',
    '/etc/passwd',
    'backup.db; rm -rf /',
  ]

  it('valid filenames', () => {
    for (const name of valid) {
      expect(/^[a-zA-Z0-9._-]+\.db$/.test(name)).toBe(true)
      expect(name.includes('..')).toBe(false)
      expect(name.includes('/')).toBe(false)
    }
  })

  it('invalid filenames blocked', () => {
    for (const name of invalid) {
      const isInvalid = name.includes('..') || name.includes('/') || !/^[a-zA-Z0-9._-]+\.db$/.test(name)
      expect(isInvalid).toBe(true)
    }
  })
})

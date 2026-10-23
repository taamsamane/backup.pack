import { describe, expect, it } from 'vitest'
import { ensureTrailingSep, joinOsPath, toOsPath } from '../src/shared/paths'

describe('toOsPath', () => {
  it('normalizes relative segments', () => {
    const result = toOsPath('a/b/../c')
    expect(result.includes('..')).toBe(false)
    expect(result.endsWith('c') || result.endsWith('c\\')).toBe(true)
  })

  it('joins segments then normalizes', () => {
    const result = joinOsPath('backup', 'task', 'cycles')
    expect(result).toContain('backup')
    expect(result).toContain('task')
    expect(result).toContain('cycles')
  })

  it('ensures trailing separator', () => {
    const withSep = ensureTrailingSep(`folder${require('path').sep}`)
    const without = ensureTrailingSep('folder')
    expect(withSep.endsWith(require('path').sep)).toBe(true)
    expect(without.endsWith(require('path').sep)).toBe(true)
  })
})

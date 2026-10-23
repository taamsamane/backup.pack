import { describe, expect, it } from 'vitest'
import { selectCyclesToPrune } from '../src/shared/backup/retention'

describe('selectCyclesToPrune', () => {
  it('keeps newest archived cycles and never prunes active', () => {
    const ids = selectCyclesToPrune(
      [
        { id: 'active', startedAt: '2026-10-22T00:00:00.000Z', status: 'active' },
        { id: 'a3', startedAt: '2026-10-21T00:00:00.000Z', status: 'archived' },
        { id: 'a2', startedAt: '2026-10-20T00:00:00.000Z', status: 'archived' },
        { id: 'a1', startedAt: '2026-10-19T00:00:00.000Z', status: 'archived' }
      ],
      2
    )
    expect(ids).toEqual(['a1'])
  })

  it('returns empty when under the keep limit', () => {
    expect(
      selectCyclesToPrune(
        [{ id: 'a1', startedAt: '2026-10-19T00:00:00.000Z', status: 'archived' }],
        3
      )
    ).toEqual([])
  })
})

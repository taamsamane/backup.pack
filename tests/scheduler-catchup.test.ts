import { describe, expect, it } from 'vitest'
import { shouldCatchUpMissedRun } from '../src/shared/backup/catchUp'

describe('shouldCatchUpMissedRun', () => {
  const previous = new Date('2026-10-24T10:00:00.000Z')

  it('is false when catch-up disabled', () => {
    expect(
      shouldCatchUpMissedRun({
        catchUpMissed: false,
        previousFireAt: previous,
        lastRunCreatedAt: null
      })
    ).toBe(false)
  })

  it('is true when no prior run exists', () => {
    expect(
      shouldCatchUpMissedRun({
        catchUpMissed: true,
        previousFireAt: previous,
        lastRunCreatedAt: null
      })
    ).toBe(true)
  })

  it('is true when last run is before the previous fire', () => {
    expect(
      shouldCatchUpMissedRun({
        catchUpMissed: true,
        previousFireAt: previous,
        lastRunCreatedAt: new Date('2026-10-24T09:00:00.000Z')
      })
    ).toBe(true)
  })

  it('is false when last run is at or after the previous fire', () => {
    expect(
      shouldCatchUpMissedRun({
        catchUpMissed: true,
        previousFireAt: previous,
        lastRunCreatedAt: new Date('2026-10-24T10:00:00.000Z')
      })
    ).toBe(false)
    expect(
      shouldCatchUpMissedRun({
        catchUpMissed: true,
        previousFireAt: previous,
        lastRunCreatedAt: new Date('2026-10-24T11:00:00.000Z')
      })
    ).toBe(false)
  })

  it('is false when previous fire is unknown', () => {
    expect(
      shouldCatchUpMissedRun({
        catchUpMissed: true,
        previousFireAt: null,
        lastRunCreatedAt: null
      })
    ).toBe(false)
  })
})

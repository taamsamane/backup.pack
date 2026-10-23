import type { FullPeriod } from '../tasks'

const DAY_MS = 24 * 60 * 60 * 1000

/** Convert a fullPeriod to milliseconds (month ≈ 30 days). */
export function fullPeriodToMs(period: FullPeriod): number {
  switch (period.unit) {
    case 'day':
      return period.value * DAY_MS
    case 'week':
      return period.value * 7 * DAY_MS
    case 'month':
      return period.value * 30 * DAY_MS
    default:
      return period.value * DAY_MS
  }
}

export function isCyclePeriodElapsed(
  cycleStartedAt: string,
  period: FullPeriod,
  now: Date
): boolean {
  const started = Date.parse(cycleStartedAt)
  if (Number.isNaN(started)) {
    return true
  }
  return now.getTime() - started >= fullPeriodToMs(period)
}

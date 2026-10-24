/**
 * Decide whether to enqueue a single catch-up run after the app/scheduler starts.
 *
 * Semantics: if catch-up is enabled and the previous cron fire is later than the
 * last recorded run for the task, enqueue exactly one run (not a stack of missed ticks).
 */
export function shouldCatchUpMissedRun(input: {
  catchUpMissed: boolean
  /** Croner's previous scheduled fire before "now". */
  previousFireAt: Date | null
  /** createdAt of the most recent task_runs row, if any. */
  lastRunCreatedAt: Date | null
}): boolean {
  if (!input.catchUpMissed || !input.previousFireAt) {
    return false
  }
  if (!input.lastRunCreatedAt) {
    return true
  }
  return input.lastRunCreatedAt.getTime() < input.previousFireAt.getTime()
}

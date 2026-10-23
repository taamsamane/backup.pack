export type RetainedCycle = {
  id: string
  startedAt: string
  status: 'active' | 'finalizing' | 'archived'
}

/**
 * Given cycles newest-first (or any order), return ids that exceed keepCycles.
 * Active cycles are never selected for deletion.
 */
export function selectCyclesToPrune(
  cycles: RetainedCycle[],
  keepCycles: number
): string[] {
  if (keepCycles < 1) {
    return []
  }
  const sorted = [...cycles].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const eligible = sorted.filter((c) => c.status === 'archived')
  if (eligible.length <= keepCycles) {
    return []
  }
  return eligible.slice(keepCycles).map((c) => c.id)
}

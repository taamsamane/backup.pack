import type { TaskBackupSettings } from '../tasks'
import { isCyclePeriodElapsed } from './period'
import type { BackupPlan, CycleSnapshot } from './types'

function formatCycleFolderName(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}_full`
}

/**
 * Decide what this run should do given task settings and the active cycle.
 * Pure function — pass `now` for deterministic tests.
 *
 * Semantics:
 * - fullBackup=true, no fullPeriod → every run is a complete backup (new cycle each time).
 * - fullBackup=true + fullPeriod → baseline, then changes; rollover when period ends.
 * - fullBackup=false → baseline once, then only changes (never rollover).
 */
export function planBackupRun(input: {
  settings: TaskBackupSettings
  activeCycle: CycleSnapshot | null
  now?: Date
}): BackupPlan {
  const now = input.now ?? new Date()
  const { settings, activeCycle } = input
  const newCycleFolderName = formatCycleFolderName(now)

  if (settings.fullBackup && !settings.fullPeriod) {
    return {
      action: 'full_every_run',
      reason: 'fullBackup without fullPeriod — complete backup every run',
      activeCycle,
      cycleToFinalize: activeCycle?.status === 'active' ? activeCycle : null,
      newCycleFolderName,
      settings
    }
  }

  if (settings.fullBackup && settings.fullPeriod) {
    if (!activeCycle || activeCycle.status !== 'active') {
      return {
        action: 'baseline',
        reason: 'No active cycle — create baseline',
        activeCycle: null,
        cycleToFinalize: null,
        newCycleFolderName,
        settings
      }
    }
    if (isCyclePeriodElapsed(activeCycle.startedAt, settings.fullPeriod, now)) {
      return {
        action: 'rollover_then_baseline',
        reason: `Active cycle period (${settings.fullPeriod.value} ${settings.fullPeriod.unit}) elapsed`,
        activeCycle,
        cycleToFinalize: activeCycle,
        newCycleFolderName,
        settings
      }
    }
    return {
      action: 'changes',
      reason: 'Within fullPeriod — store changes only',
      activeCycle,
      cycleToFinalize: null,
      newCycleFolderName: null,
      settings
    }
  }

  // fullBackup=false
  if (!activeCycle || activeCycle.status !== 'active') {
    return {
      action: 'baseline',
      reason: 'fullBackup=false — first run creates baseline',
      activeCycle: null,
      cycleToFinalize: null,
      newCycleFolderName,
      settings
    }
  }
  return {
    action: 'changes',
    reason: 'fullBackup=false — changes after baseline (no rollover)',
    activeCycle,
    cycleToFinalize: null,
    newCycleFolderName: null,
    settings
  }
}

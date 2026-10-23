import { describe, expect, it } from 'vitest'
import { planBackupRun } from '../src/shared/backup/planner'
import type { TaskBackupSettings } from '../src/shared/tasks'

const baseSettings = (partial: Partial<TaskBackupSettings>): TaskBackupSettings => ({
  fullBackup: true,
  compress: true,
  encryptArchive: false,
  excludePatterns: [],
  ...partial
})

describe('planBackupRun', () => {
  const now = new Date('2026-10-22T12:00:00.000Z')

  it('fullBackup without fullPeriod → full_every_run', () => {
    const plan = planBackupRun({
      settings: baseSettings({ fullBackup: true }),
      activeCycle: null,
      now
    })
    expect(plan.action).toBe('full_every_run')
    expect(plan.newCycleFolderName).toBe('2026-10-22_full')
  })

  it('fullBackup + fullPeriod with no cycle → baseline', () => {
    const plan = planBackupRun({
      settings: baseSettings({
        fullBackup: true,
        fullPeriod: { value: 7, unit: 'day' }
      }),
      activeCycle: null,
      now
    })
    expect(plan.action).toBe('baseline')
  })

  it('fullBackup + fullPeriod within window → changes', () => {
    const plan = planBackupRun({
      settings: baseSettings({
        fullBackup: true,
        fullPeriod: { value: 7, unit: 'day' }
      }),
      activeCycle: {
        id: 'c1',
        folderName: '2026-10-20_full',
        startedAt: '2026-10-20T12:00:00.000Z',
        status: 'active'
      },
      now
    })
    expect(plan.action).toBe('changes')
    expect(plan.cycleToFinalize).toBeNull()
  })

  it('fullBackup + fullPeriod elapsed → rollover_then_baseline', () => {
    const plan = planBackupRun({
      settings: baseSettings({
        fullBackup: true,
        fullPeriod: { value: 1, unit: 'day' }
      }),
      activeCycle: {
        id: 'c1',
        folderName: '2026-10-20_full',
        startedAt: '2026-10-20T12:00:00.000Z',
        status: 'active'
      },
      now
    })
    expect(plan.action).toBe('rollover_then_baseline')
    expect(plan.cycleToFinalize?.id).toBe('c1')
    expect(plan.newCycleFolderName).toBe('2026-10-22_full')
  })

  it('fullBackup=false after baseline → changes (no rollover)', () => {
    const plan = planBackupRun({
      settings: baseSettings({ fullBackup: false }),
      activeCycle: {
        id: 'c1',
        folderName: '2026-10-01_full',
        startedAt: '2026-01-01T00:00:00.000Z',
        status: 'active'
      },
      now
    })
    expect(plan.action).toBe('changes')
    expect(plan.cycleToFinalize).toBeNull()
  })
})

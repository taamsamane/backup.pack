import type { FullPeriod, TaskBackupSettings } from '../tasks'

export type BackupAction =
  | 'full_every_run'
  | 'baseline'
  | 'changes'
  | 'rollover_then_baseline'

export type CycleSnapshot = {
  id: string
  folderName: string
  startedAt: string
  status: 'active' | 'finalizing' | 'archived'
}

export type BackupPlan = {
  action: BackupAction
  reason: string
  /** Existing active cycle to write changes into (if any). */
  activeCycle: CycleSnapshot | null
  /** When action includes rollover, this cycle should be finalized first. */
  cycleToFinalize: CycleSnapshot | null
  /** New cycle folder name when creating a baseline. */
  newCycleFolderName: string | null
  settings: TaskBackupSettings
}

export type ManifestEntry = {
  path: string
  size: number | null
  mtime: string | null
  hash: string | null
  etag: string | null
  state: 'present' | 'deleted'
}

export type ManifestDiff = {
  added: ManifestEntry[]
  changed: ManifestEntry[]
  deleted: ManifestEntry[]
  unchanged: number
}

export type FullPeriodMs = {
  value: number
  unit: FullPeriod['unit']
}

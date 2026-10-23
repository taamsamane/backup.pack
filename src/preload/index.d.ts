import type { BackupHubApi } from '../shared/ipc/api'

declare global {
  interface Window {
    backupHub: BackupHubApi
  }
}

export {}

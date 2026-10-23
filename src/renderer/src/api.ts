import type { BackupHubApi } from '../../shared/ipc/api'

/** Typed access to the preload bridge; fails clearly if preload did not load. */
export function getBackupHubApi(): BackupHubApi {
  const api = window.backupHub
  if (!api) {
    throw new Error(
      'BackupHub preload API is unavailable (window.backupHub is undefined). Restart the app after a clean rebuild.'
    )
  }
  return api
}

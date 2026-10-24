import { Notification, app } from 'electron'
import { getAllSettingsFromDb } from '../db/database'
import { getLogger } from '../logging/logger'

export function notifyBackupFinished(input: {
  taskName: string | null
  status: 'success' | 'failed' | 'cancelled' | 'dry_run'
  errorMessage?: string | null
}): void {
  if (!Notification.isSupported()) {
    return
  }

  let settings
  try {
    settings = getAllSettingsFromDb()
  } catch {
    return
  }

  const isFail = input.status === 'failed' || input.status === 'cancelled'
  const isOk = input.status === 'success' || input.status === 'dry_run'

  if (isFail && !settings.notifyOnFailure) {
    return
  }
  if (isOk && !settings.notifyOnSuccess) {
    return
  }
  if (!isFail && !isOk) {
    return
  }

  const name = input.taskName?.trim() || 'Backup task'
  const title = isFail ? 'Backup failed' : input.status === 'dry_run' ? 'Dry-run finished' : 'Backup completed'
  const body = isFail
    ? `${name}: ${input.errorMessage?.slice(0, 180) || 'Unknown error'}`
    : `${name} finished successfully.`

  try {
    const notification = new Notification({
      title: `BackupHub — ${title}`,
      body,
      silent: false
    })
    notification.show()
  } catch (error) {
    getLogger('notifications').warn(
      { err: error instanceof Error ? error.message : String(error) },
      'Failed to show notification'
    )
  }
}

export function notifyUpdateAvailable(version: string): void {
  if (!Notification.isSupported()) {
    return
  }
  try {
    new Notification({
      title: 'BackupHub — Update available',
      body: `Version ${version} is ready to download.`,
      silent: true
    }).show()
  } catch {
    // ignore
  }
}

/** Linux packaged apps sometimes need the app name registered for notifications. */
export function ensureNotificationAppName(): void {
  if (process.platform === 'linux' && app.isPackaged) {
    try {
      app.setAppUserModelId('com.backuphub.app')
    } catch {
      // ignore
    }
  }
}

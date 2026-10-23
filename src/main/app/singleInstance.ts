import { app } from 'electron'
import { showMainWindow } from './window'

/**
 * Enforce a single BackupHub process. Returns false when this process should exit.
 */
export function acquireSingleInstanceLock(): boolean {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    return false
  }

  app.on('second-instance', () => {
    showMainWindow()
  })

  return true
}

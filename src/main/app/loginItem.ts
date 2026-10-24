import { app } from 'electron'
import { getLogger } from '../logging/logger'
import { applyLinuxAutostart } from './linuxAutostart'

/**
 * Sync OS login-item / open-at-login with the stored setting.
 */
export function applyLaunchOnLogin(enabled: boolean): void {
  const log = getLogger('loginItem')

  if (process.platform === 'linux') {
    applyLinuxAutostart(enabled)
    return
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()]
  })

  log.info({ enabled }, 'Login item updated')
}

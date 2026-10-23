import { app } from 'electron'
import { getLogger } from '../logging/logger'

/**
 * Sync OS login-item / open-at-login with the stored setting.
 */
export function applyLaunchOnLogin(enabled: boolean): void {
  const log = getLogger('loginItem')

  if (process.platform === 'linux') {
    // Electron login items are best-supported on Windows/macOS.
    // Linux desktop autostart will be handled in a later polish phase if needed.
    log.info({ enabled }, 'launchOnLogin requested (Linux: deferred to settings UI note)')
    return
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()]
  })

  log.info({ enabled }, 'Login item updated')
}

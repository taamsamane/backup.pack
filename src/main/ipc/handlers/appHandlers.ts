import { app } from 'electron'
import { join } from 'path'
import { IpcChannels } from '../../../shared/ipc/channels'
import { EmptyPayloadSchema } from '../../../shared/ipc/schemas'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  quitAndInstallUpdate
} from '../../app/updater'
import {
  hideMainWindowToTray,
  setIntentionallyQuitting,
  showMainWindow
} from '../../app/window'
import {
  getDatabasePath,
  getDbHealthSnapshot
} from '../../db/database'
import { getLogsDirectory } from '../../logging/logger'
import { parseIpcPayload } from '../../security/ipcValidate'
import type { IpcRegistrar } from '../register'

export function registerAppHandlers(register: IpcRegistrar): void {
  register(IpcChannels.APP_GET_INFO, async (payload) => {
    parseIpcPayload(IpcChannels.APP_GET_INFO, EmptyPayloadSchema, payload)
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged
    }
  })

  register(IpcChannels.APP_GET_PATHS, async (payload) => {
    parseIpcPayload(IpcChannels.APP_GET_PATHS, EmptyPayloadSchema, payload)
    const userData = app.getPath('userData')
    return {
      userData,
      logs: getLogsDirectory(),
      database: getDatabasePath(),
      drivers: join(userData, 'drivers')
    }
  })

  register(IpcChannels.APP_QUIT, async (payload) => {
    parseIpcPayload(IpcChannels.APP_QUIT, EmptyPayloadSchema, payload)
    setIntentionallyQuitting(true)
    app.quit()
  })

  register(IpcChannels.APP_SHOW_MAIN_WINDOW, async (payload) => {
    parseIpcPayload(IpcChannels.APP_SHOW_MAIN_WINDOW, EmptyPayloadSchema, payload)
    showMainWindow()
  })

  register(IpcChannels.WINDOW_HIDE_TO_TRAY, async (payload) => {
    parseIpcPayload(IpcChannels.WINDOW_HIDE_TO_TRAY, EmptyPayloadSchema, payload)
    hideMainWindowToTray()
  })

  register(IpcChannels.DB_HEALTH, async (payload) => {
    parseIpcPayload(IpcChannels.DB_HEALTH, EmptyPayloadSchema, payload)
    return getDbHealthSnapshot()
  })

  register(IpcChannels.APP_GET_UPDATE_STATUS, async (payload) => {
    parseIpcPayload(IpcChannels.APP_GET_UPDATE_STATUS, EmptyPayloadSchema, payload)
    return getUpdateStatus()
  })

  register(IpcChannels.APP_CHECK_UPDATE, async (payload) => {
    parseIpcPayload(IpcChannels.APP_CHECK_UPDATE, EmptyPayloadSchema, payload)
    return checkForUpdates()
  })

  register(IpcChannels.APP_DOWNLOAD_UPDATE, async (payload) => {
    parseIpcPayload(IpcChannels.APP_DOWNLOAD_UPDATE, EmptyPayloadSchema, payload)
    return downloadUpdate()
  })

  register(IpcChannels.APP_QUIT_AND_INSTALL, async (payload) => {
    parseIpcPayload(IpcChannels.APP_QUIT_AND_INSTALL, EmptyPayloadSchema, payload)
    quitAndInstallUpdate()
    return { ok: true as const }
  })
}

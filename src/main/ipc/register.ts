import { ipcMain } from 'electron'
import type { IpcChannel } from '../../shared/ipc/channels'
import { getLogger } from '../logging/logger'
import { toIpcErrorMessage } from '../security/ipcValidate'
import { registerAppHandlers } from './handlers/appHandlers'
import { registerProfilesHandlers } from './handlers/profilesHandlers'
import { registerSettingsHandlers } from './handlers/settingsHandlers'
import { registerTasksHandlers } from './handlers/tasksHandlers'

export type IpcHandler = (payload: unknown) => Promise<unknown> | unknown
export type IpcRegistrar = (channel: IpcChannel, handler: IpcHandler) => void

/**
 * Register all main-process IPC handlers. Every handler must validate payloads with Zod.
 */
export function registerIpcHandlers(): void {
  const log = getLogger('ipc')

  const register: IpcRegistrar = (channel, handler) => {
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, async (_event, payload: unknown) => {
      try {
        return await handler(payload)
      } catch (error) {
        log.error({ channel, err: toIpcErrorMessage(error) }, 'IPC handler failed')
        throw new Error(toIpcErrorMessage(error))
      }
    })
  }

  registerAppHandlers(register)
  registerSettingsHandlers(register)
  registerProfilesHandlers(register)
  registerTasksHandlers(register)
  log.info('IPC handlers registered')
}

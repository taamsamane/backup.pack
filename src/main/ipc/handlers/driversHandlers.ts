import { BrowserWindow } from 'electron'
import { IpcChannels } from '../../../shared/ipc/channels'
import { EmptyPayloadSchema } from '../../../shared/ipc/schemas'
import { DriverInstallRequestSchema } from '../../../shared/drivers'
import { installDriver } from '../../drivers/install'
import { listDriverStatuses } from '../../drivers/resolve'
import { parseIpcPayload } from '../../security/ipcValidate'
import type { IpcRegistrar } from '../register'

export function registerDriversHandlers(register: IpcRegistrar): void {
  register(IpcChannels.DRIVERS_LIST, async (payload) => {
    parseIpcPayload(IpcChannels.DRIVERS_LIST, EmptyPayloadSchema, payload)
    return listDriverStatuses()
  })

  register(IpcChannels.DRIVERS_INSTALL, async (payload) => {
    const { toolId } = parseIpcPayload(
      IpcChannels.DRIVERS_INSTALL,
      DriverInstallRequestSchema,
      payload
    )
    return installDriver(toolId, (progress) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IpcChannels.DRIVERS_PROGRESS, progress)
      }
    })
  })
}

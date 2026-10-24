import { IpcChannels } from '../../../shared/ipc/channels'
import { EmptyPayloadSchema } from '../../../shared/ipc/schemas'
import {
  RestoreBrowseSchema,
  RestoreFilesSchema,
  RestoreListCyclesSchema,
  RestoreVerifySchema
} from '../../../shared/restore'
import {
  browseCycleRestore,
  listCyclesForRestore,
  restoreCycleFiles,
  verifyCycleArchive
} from '../../backup/restoreService'
import { parseIpcPayload } from '../../security/ipcValidate'
import { listTasks } from '../../tasks/repository'
import type { IpcRegistrar } from '../register'

export function registerRestoreHandlers(register: IpcRegistrar): void {
  register(IpcChannels.RESTORE_LIST_TASKS, async (payload) => {
    parseIpcPayload(IpcChannels.RESTORE_LIST_TASKS, EmptyPayloadSchema, payload)
    return listTasks().map((t) => ({
      id: t.id,
      name: t.name,
      targetFolder: t.targetFolder,
      profileName: t.profileName
    }))
  })

  register(IpcChannels.RESTORE_LIST_CYCLES, async (payload) => {
    const { taskId } = parseIpcPayload(
      IpcChannels.RESTORE_LIST_CYCLES,
      RestoreListCyclesSchema,
      payload
    )
    return listCyclesForRestore(taskId)
  })

  register(IpcChannels.RESTORE_BROWSE, async (payload) => {
    const data = parseIpcPayload(IpcChannels.RESTORE_BROWSE, RestoreBrowseSchema, payload)
    return browseCycleRestore({
      cycleId: data.cycleId,
      asOfStamp: data.asOfStamp
    })
  })

  register(IpcChannels.RESTORE_FILES, async (payload) => {
    const data = parseIpcPayload(IpcChannels.RESTORE_FILES, RestoreFilesSchema, payload)
    return restoreCycleFiles({
      cycleId: data.cycleId,
      destPath: data.destPath,
      asOfStamp: data.asOfStamp,
      paths: data.paths
    })
  })

  register(IpcChannels.RESTORE_VERIFY, async (payload) => {
    const { cycleId } = parseIpcPayload(
      IpcChannels.RESTORE_VERIFY,
      RestoreVerifySchema,
      payload
    )
    return verifyCycleArchive(cycleId)
  })
}

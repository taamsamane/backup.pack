import { AppSettingsSchema } from '../../../shared/settings'
import { IpcChannels } from '../../../shared/ipc/channels'
import {
  EmptyPayloadSchema,
  SettingsGetPayloadSchema,
  SettingsSetManyPayloadSchema,
  SettingsSetPayloadSchema
} from '../../../shared/ipc/schemas'
import { applyLaunchOnLogin } from '../../app/loginItem'
import {
  getAllSettingsFromDb,
  getSettingFromDb,
  setSettingsInDb
} from '../../db/database'
import { setLogLevel } from '../../logging/logger'
import { parseIpcPayload } from '../../security/ipcValidate'
import type { IpcRegistrar } from '../register'

export function registerSettingsHandlers(register: IpcRegistrar): void {
  register(IpcChannels.SETTINGS_GET_ALL, async (payload) => {
    parseIpcPayload(IpcChannels.SETTINGS_GET_ALL, EmptyPayloadSchema, payload)
    return getAllSettingsFromDb()
  })

  register(IpcChannels.SETTINGS_GET, async (payload) => {
    const { key } = parseIpcPayload(IpcChannels.SETTINGS_GET, SettingsGetPayloadSchema, payload)
    return getSettingFromDb(key as keyof ReturnType<typeof getAllSettingsFromDb>)
  })

  register(IpcChannels.SETTINGS_SET, async (payload) => {
    const { key, value } = parseIpcPayload(
      IpcChannels.SETTINGS_SET,
      SettingsSetPayloadSchema,
      payload
    )

    const candidate = { [key]: value }
    const parsedPartial = AppSettingsSchema.partial().parse(candidate)
    const updated = setSettingsInDb(parsedPartial)
    applySideEffects(parsedPartial)
    return updated
  })

  register(IpcChannels.SETTINGS_SET_MANY, async (payload) => {
    const { values } = parseIpcPayload(
      IpcChannels.SETTINGS_SET_MANY,
      SettingsSetManyPayloadSchema,
      payload
    )
    const updated = setSettingsInDb(values)
    applySideEffects(values)
    return updated
  })
}

function applySideEffects(values: Partial<ReturnType<typeof getAllSettingsFromDb>>): void {
  if (values.logLevel !== undefined) {
    setLogLevel(values.logLevel)
  }
  if (values.launchOnLogin !== undefined) {
    applyLaunchOnLogin(values.launchOnLogin)
  }
}

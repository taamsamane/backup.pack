import { IpcChannels } from '../../../shared/ipc/channels'
import { EmptyPayloadSchema } from '../../../shared/ipc/schemas'
import {
  ProfileCreateSchema,
  ProfileIdSchema,
  ProfileTestSchema,
  ProfileUpdateSchema,
  SshHostKeyDecisionSchema
} from '../../../shared/profiles'
import {
  createProfile,
  deleteProfile,
  getProfileDto,
  listProfiles,
  updateProfile
} from '../../profiles/repository'
import { testConnection } from '../../profiles/testers'
import { parseIpcPayload } from '../../security/ipcValidate'
import { resolveHostKeyDecision } from '../../security/sshHostKeys'
import type { IpcRegistrar } from '../register'

export function registerProfilesHandlers(register: IpcRegistrar): void {
  register(IpcChannels.PROFILES_LIST, async (payload) => {
    parseIpcPayload(IpcChannels.PROFILES_LIST, EmptyPayloadSchema, payload)
    return listProfiles()
  })

  register(IpcChannels.PROFILES_GET, async (payload) => {
    const { id } = parseIpcPayload(IpcChannels.PROFILES_GET, ProfileIdSchema, payload)
    const profile = getProfileDto(id)
    if (!profile) {
      throw new Error('Profile not found')
    }
    return profile
  })

  register(IpcChannels.PROFILES_CREATE, async (payload) => {
    const data = parseIpcPayload(IpcChannels.PROFILES_CREATE, ProfileCreateSchema, payload)
    return createProfile(data)
  })

  register(IpcChannels.PROFILES_UPDATE, async (payload) => {
    const data = parseIpcPayload(IpcChannels.PROFILES_UPDATE, ProfileUpdateSchema, payload)
    return updateProfile(data)
  })

  register(IpcChannels.PROFILES_DELETE, async (payload) => {
    const { id } = parseIpcPayload(IpcChannels.PROFILES_DELETE, ProfileIdSchema, payload)
    deleteProfile(id)
    return { ok: true }
  })

  register(IpcChannels.PROFILES_TEST, async (payload) => {
    const data = parseIpcPayload(IpcChannels.PROFILES_TEST, ProfileTestSchema, payload)
    return testConnection(data)
  })

  register(IpcChannels.SSH_HOST_KEY_DECISION, async (payload) => {
    const decision = parseIpcPayload(
      IpcChannels.SSH_HOST_KEY_DECISION,
      SshHostKeyDecisionSchema,
      payload
    )
    resolveHostKeyDecision(decision)
    return { ok: true }
  })
}

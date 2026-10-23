import type { TaskBackupSettings } from '../../shared/tasks'
import { TaskBackupSettingsSchema } from '../../shared/tasks'
import { encryptCredentials, decryptCredentials } from '../security/secrets'

export type StoredTaskSettings = TaskBackupSettings & {
  archivePasswordEncrypted?: string | null
}

export function serializeTaskSettings(
  settings: TaskBackupSettings,
  archivePassword: string | undefined,
  existingEncrypted: string | null | undefined,
  clearPassword: boolean | undefined
): string {
  const parsed = TaskBackupSettingsSchema.parse(settings)
  let archivePasswordEncrypted: string | null | undefined = existingEncrypted ?? null

  if (clearPassword) {
    archivePasswordEncrypted = null
  } else if (archivePassword) {
    archivePasswordEncrypted = encryptCredentials({ password: archivePassword })
  } else if (parsed.encryptArchive && !archivePasswordEncrypted) {
    throw new Error('Archive password is required when encryptArchive is enabled')
  }

  if (!parsed.encryptArchive) {
    archivePasswordEncrypted = null
  }

  const stored: StoredTaskSettings = {
    ...parsed,
    archivePasswordEncrypted: archivePasswordEncrypted ?? null
  }
  return JSON.stringify(stored)
}

export function parseTaskSettings(json: string): {
  settings: TaskBackupSettings
  hasArchivePassword: boolean
  archivePasswordEncrypted: string | null
} {
  const raw = JSON.parse(json || '{}') as StoredTaskSettings
  const { archivePasswordEncrypted, ...rest } = raw
  const settings = TaskBackupSettingsSchema.parse({
    ...rest,
    excludePatterns: rest.excludePatterns ?? []
  })
  return {
    settings,
    hasArchivePassword: Boolean(archivePasswordEncrypted),
    archivePasswordEncrypted: archivePasswordEncrypted ?? null
  }
}

/** Decrypt archive password for the backup engine (never send to renderer). */
export function loadArchivePassword(encrypted: string | null | undefined): string | null {
  if (!encrypted) {
    return null
  }
  const creds = decryptCredentials(encrypted)
  return creds.password ?? null
}

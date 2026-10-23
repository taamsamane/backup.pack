import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import {
  ProfileCreateSchema,
  ProfileOptionsSchema,
  ProfileUpdateSchema,
  isDbProfileType,
  isSshJumpProfileType,
  type ProfileCreateInput,
  type ProfileDto,
  type ProfileOptions,
  type ProfileType,
  type ProfileUpdateInput
} from '../../shared/profiles'
import { getOrm } from '../db/client'
import { profiles } from '../db/schema'
import {
  credentialPresence,
  decryptCredentials,
  encryptCredentials,
  mergeCredentials
} from '../security/secrets'

function parseOptions(json: string): ProfileOptions {
  return ProfileOptionsSchema.parse(JSON.parse(json || '{}'))
}

function assertValidSshTunnel(
  profileType: ProfileType,
  options: ProfileOptions | undefined,
  selfId?: string
): void {
  const tunnelId = options?.sshTunnelProfileId
  if (!tunnelId) {
    return
  }
  if (!isDbProfileType(profileType)) {
    throw new Error('SSH tunnel is only supported for database profiles')
  }
  if (selfId && tunnelId === selfId) {
    throw new Error('A profile cannot use itself as an SSH tunnel')
  }
  const jump = getOrm().select().from(profiles).where(eq(profiles.id, tunnelId)).get()
  if (!jump) {
    throw new Error('SSH tunnel profile not found — create an SSH/SFTP profile first')
  }
  if (!isSshJumpProfileType(jump.type)) {
    throw new Error('SSH tunnel must reference a profile of type ssh or sftp')
  }
}

function toDto(row: typeof profiles.$inferSelect): ProfileDto {
  const credentials = decryptCredentials(row.credentialsEncrypted)
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    host: row.host,
    port: row.port,
    username: row.username,
    authMethod: row.authMethod,
    options: parseOptions(row.optionsJson),
    credentials: credentialPresence(credentials),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export function listProfiles(): ProfileDto[] {
  const rows = getOrm().select().from(profiles).all()
  return rows
    .map((row) => toDto(row))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getProfileDto(id: string): ProfileDto | null {
  const row = getOrm().select().from(profiles).where(eq(profiles.id, id)).get()
  return row ? toDto(row) : null
}

export function getProfileRow(id: string): typeof profiles.$inferSelect | null {
  return getOrm().select().from(profiles).where(eq(profiles.id, id)).get() ?? null
}

export function createProfile(input: ProfileCreateInput): ProfileDto {
  const data = ProfileCreateSchema.parse(input)
  assertValidSshTunnel(data.type, data.options)
  const now = new Date().toISOString()
  const id = randomUUID()
  const credentials = data.credentials ?? {}
  const encrypted =
    Object.keys(credentials).length > 0 ? encryptCredentials(credentials) : null

  getOrm()
    .insert(profiles)
    .values({
      id,
      name: data.name,
      type: data.type,
      host: data.host ?? null,
      port: data.port ?? null,
      username: data.username ?? null,
      authMethod: data.authMethod,
      credentialsEncrypted: encrypted,
      optionsJson: JSON.stringify(data.options ?? {}),
      createdAt: now,
      updatedAt: now
    })
    .run()

  const created = getProfileDto(id)
  if (!created) {
    throw new Error('Failed to load profile after create')
  }
  return created
}

export function updateProfile(input: ProfileUpdateInput): ProfileDto {
  const data = ProfileUpdateSchema.parse(input)
  const existing = getProfileRow(data.id)
  if (!existing) {
    throw new Error('Profile not found')
  }

  const nextOptions =
    data.options !== undefined ? data.options : parseOptions(existing.optionsJson)
  assertValidSshTunnel(existing.type, nextOptions, data.id)

  const currentSecrets = decryptCredentials(existing.credentialsEncrypted)
  const merged = mergeCredentials(currentSecrets, data.credentials, data.clearCredentials)
  const encrypted = merged ? encryptCredentials(merged) : null

  const now = new Date().toISOString()
  getOrm()
    .update(profiles)
    .set({
      name: data.name ?? existing.name,
      host: data.host !== undefined ? data.host : existing.host,
      port: data.port !== undefined ? data.port : existing.port,
      username: data.username !== undefined ? data.username : existing.username,
      authMethod: data.authMethod ?? existing.authMethod,
      credentialsEncrypted: encrypted,
      optionsJson: JSON.stringify(nextOptions),
      updatedAt: now
    })
    .where(eq(profiles.id, data.id))
    .run()

  const updated = getProfileDto(data.id)
  if (!updated) {
    throw new Error('Failed to load profile after update')
  }
  return updated
}

export function deleteProfile(id: string): void {
  const result = getOrm().delete(profiles).where(eq(profiles.id, id)).run()
  if (result.changes === 0) {
    throw new Error('Profile not found')
  }
}

/** Internal: decrypted credentials for connection tests (never send to renderer). */
export function loadProfileForConnection(id: string): {
  dto: ProfileDto
  credentials: ReturnType<typeof decryptCredentials>
  options: ProfileOptions
  row: typeof profiles.$inferSelect
} {
  const row = getProfileRow(id)
  if (!row) {
    throw new Error('Profile not found')
  }
  return {
    dto: toDto(row),
    credentials: decryptCredentials(row.credentialsEncrypted),
    options: parseOptions(row.optionsJson),
    row
  }
}

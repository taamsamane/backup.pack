import { z } from 'zod'

export const ProfileTypeSchema = z.enum([
  'sftp',
  'ftp',
  'ssh',
  'mysql',
  'mariadb',
  'postgres',
  'mssql',
  'mongodb',
  'sqlite',
  'aws-s3'
])
export type ProfileType = z.infer<typeof ProfileTypeSchema>

export const AuthMethodSchema = z.enum([
  'password',
  'key',
  'aws-keys',
  'aws-profile',
  'none'
])
export type AuthMethod = z.infer<typeof AuthMethodSchema>

/** Secrets never returned to the renderer after save (only presence flags). */
export const ProfileCredentialsSchema = z
  .object({
    password: z.string().optional(),
    privateKey: z.string().optional(),
    passphrase: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    sessionToken: z.string().optional()
  })
  .strict()

export type ProfileCredentials = z.infer<typeof ProfileCredentialsSchema>

export const ProfileOptionsSchema = z
  .object({
    /** SQLite file path (local). */
    filePath: z.string().optional(),
    /** AWS / S3-compatible. */
    region: z.string().optional(),
    endpoint: z.string().optional(),
    forcePathStyle: z.boolean().optional(),
    awsProfile: z.string().optional(),
    bucket: z.string().optional(),
    /** FTP */
    secure: z.boolean().optional(),
    /**
     * Remote directory / key prefix to back up.
     * - SFTP / FTP / SSH: absolute (`/var/www`) or relative to login home (`.` / `uploads`).
     * - AWS S3: object key prefix (e.g. `backups/prod`); empty / `.` = whole bucket.
     */
    remotePath: z.string().trim().min(1).max(1024).optional(),
    /** SSH/SFTP readyTimeout ms */
    readyTimeoutMs: z.number().int().positive().optional(),
    /** Default database name for DB profiles */
    database: z.string().optional(),
    /** MongoDB authSource */
    authSource: z.string().optional(),
    /** MSSQL encrypt */
    encrypt: z.boolean().optional(),
    trustServerCertificate: z.boolean().optional(),
    /**
     * Optional SSH jump host for DB profiles (mysql/mariadb/postgres/mssql/mongodb).
     * Must reference a saved profile of type `ssh` or `sftp`.
     * Host/port on the DB profile are the destination as reachable FROM the SSH server
     * (often 127.0.0.1:3306).
     */
    sshTunnelProfileId: z.string().uuid().optional()
  })
  .strict()

export type ProfileOptions = z.infer<typeof ProfileOptionsSchema>

export const DB_PROFILE_TYPES = [
  'mysql',
  'mariadb',
  'postgres',
  'mssql',
  'mongodb'
] as const satisfies ReadonlyArray<ProfileType>

export type DbProfileType = (typeof DB_PROFILE_TYPES)[number]

export function isDbProfileType(type: ProfileType): type is DbProfileType {
  return (DB_PROFILE_TYPES as ReadonlyArray<string>).includes(type)
}

export function isSshJumpProfileType(type: ProfileType): boolean {
  return type === 'ssh' || type === 'sftp'
}

export const ProfileCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: ProfileTypeSchema,
    host: z.string().trim().min(1).max(255).nullable().optional(),
    port: z.number().int().min(1).max(65535).nullable().optional(),
    username: z.string().trim().max(255).nullable().optional(),
    authMethod: AuthMethodSchema,
    credentials: ProfileCredentialsSchema.optional(),
    options: ProfileOptionsSchema.optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === 'sqlite') {
      if (!value.options?.filePath) {
        ctx.addIssue({
          code: 'custom',
          message: 'SQLite profiles require options.filePath',
          path: ['options', 'filePath']
        })
      }
      return
    }
    if (value.type === 'aws-s3') {
      if (value.authMethod === 'aws-keys') {
        if (!value.credentials?.accessKeyId || !value.credentials?.secretAccessKey) {
          ctx.addIssue({
            code: 'custom',
            message: 'AWS keys auth requires accessKeyId and secretAccessKey',
            path: ['credentials']
          })
        }
      } else if (value.authMethod === 'aws-profile') {
        if (!value.options?.awsProfile) {
          ctx.addIssue({
            code: 'custom',
            message: 'AWS profile auth requires options.awsProfile',
            path: ['options', 'awsProfile']
          })
        }
      }
      return
    }
    if (!value.host) {
      ctx.addIssue({
        code: 'custom',
        message: 'Host is required for this profile type',
        path: ['host']
      })
    }
    if (value.authMethod === 'password' && !value.credentials?.password) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password is required for password auth',
        path: ['credentials', 'password']
      })
    }
    if (value.authMethod === 'key' && !value.credentials?.privateKey) {
      ctx.addIssue({
        code: 'custom',
        message: 'Private key is required for key auth',
        path: ['credentials', 'privateKey']
      })
    }
    if (value.options?.sshTunnelProfileId) {
      if (!isDbProfileType(value.type)) {
        ctx.addIssue({
          code: 'custom',
          message: 'SSH tunnel is only supported for database profiles',
          path: ['options', 'sshTunnelProfileId']
        })
      }
    }
  })

export type ProfileCreateInput = z.infer<typeof ProfileCreateSchema>

export const ProfileUpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    host: z.string().trim().min(1).max(255).nullable().optional(),
    port: z.number().int().min(1).max(65535).nullable().optional(),
    username: z.string().trim().max(255).nullable().optional(),
    authMethod: AuthMethodSchema.optional(),
    /** When set, replaces stored secrets. Omit to keep existing credentials. */
    credentials: ProfileCredentialsSchema.optional(),
    clearCredentials: z.boolean().optional(),
    options: ProfileOptionsSchema.optional()
  })
  .strict()

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>

export const ProfileIdSchema = z.object({
  id: z.string().uuid()
})

export const CredentialPresenceSchema = z.object({
  hasPassword: z.boolean(),
  hasPrivateKey: z.boolean(),
  hasPassphrase: z.boolean(),
  hasAccessKeyId: z.boolean(),
  hasSecretAccessKey: z.boolean(),
  hasSessionToken: z.boolean()
})

export type CredentialPresence = z.infer<typeof CredentialPresenceSchema>

/** Safe profile DTO returned to the renderer (no secret values). */
export const ProfileDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: ProfileTypeSchema,
  host: z.string().nullable(),
  port: z.number().nullable(),
  username: z.string().nullable(),
  authMethod: AuthMethodSchema,
  options: ProfileOptionsSchema,
  credentials: CredentialPresenceSchema,
  createdAt: z.string(),
  updatedAt: z.string()
})

export type ProfileDto = z.infer<typeof ProfileDtoSchema>

export const ConnectionTestResultSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  latencyMs: z.number().nonnegative(),
  details: z.record(z.string(), z.unknown()).optional()
})

export type ConnectionTestResult = z.infer<typeof ConnectionTestResultSchema>

/** Test either a saved profile id, or an unsaved draft (credentials in payload). */
export const ProfileTestSchema = z.union([
  z.object({ id: z.string().uuid() }).strict(),
  ProfileCreateSchema
])

export type ProfileTestInput = z.infer<typeof ProfileTestSchema>

export const SshHostKeyPromptSchema = z.object({
  requestId: z.string().uuid(),
  host: z.string(),
  port: z.number().int(),
  fingerprint: z.string(),
  algorithm: z.string(),
  isNew: z.boolean(),
  previousFingerprint: z.string().nullable()
})

export type SshHostKeyPrompt = z.infer<typeof SshHostKeyPromptSchema>

export const SshHostKeyDecisionSchema = z.object({
  requestId: z.string().uuid(),
  trust: z.boolean()
})

export type SshHostKeyDecision = z.infer<typeof SshHostKeyDecisionSchema>

export const DEFAULT_PORTS: Record<Exclude<ProfileType, 'sqlite' | 'aws-s3'>, number> = {
  sftp: 22,
  ftp: 21,
  ssh: 22,
  mysql: 3306,
  mariadb: 3306,
  postgres: 5432,
  mssql: 1433,
  mongodb: 27017
}

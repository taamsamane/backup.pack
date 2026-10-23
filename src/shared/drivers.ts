import { z } from 'zod'
import {
  DRIVER_MIRROR_ARTIFACTS,
  type DriverMirrorPlatform,
  driverMirrorUrl
} from './driversMirror'

export const DriverToolIdSchema = z.enum([
  'sqlpackage',
  'mariadb',
  'postgresql',
  'mongodb-database-tools',
  '7zip'
])
export type DriverToolId = z.infer<typeof DriverToolIdSchema>

export const DriverStatusSchema = z.object({
  toolId: DriverToolIdSchema,
  name: z.string(),
  version: z.string(),
  platform: z.string(),
  availableForPlatform: z.boolean(),
  installed: z.boolean(),
  installPath: z.string().nullable(),
  binaries: z.array(
    z.object({
      name: z.string(),
      path: z.string().nullable(),
      found: z.boolean()
    })
  ),
  downloadUrl: z.string().nullable(),
  filename: z.string().nullable()
})

export type DriverStatus = z.infer<typeof DriverStatusSchema>

export const DriverInstallRequestSchema = z
  .object({
    toolId: DriverToolIdSchema
  })
  .strict()

export const DriverToolIdPayloadSchema = DriverInstallRequestSchema

/** Relative binary paths inside extracted archives (per platform). */
export const DRIVER_BINARIES: Record<
  DriverToolId,
  Partial<Record<DriverMirrorPlatform, string[]>>
> = {
  sqlpackage: {
    'linux-x64': ['sqlpackage'],
    'darwin-x64': ['sqlpackage'],
    'win-x64': ['sqlpackage.exe']
  },
  'mongodb-database-tools': {
    'linux-x64': ['bin/mongodump', 'bin/mongorestore'],
    'darwin-x64': ['bin/mongodump', 'bin/mongorestore'],
    'darwin-arm64': ['bin/mongodump', 'bin/mongorestore'],
    'win-x64': ['bin/mongodump.exe', 'bin/mongorestore.exe']
  },
  postgresql: {
    'linux-x64': ['bin/pg_dump', 'bin/pg_restore', 'bin/psql'],
    'linux-arm64': ['bin/pg_dump', 'bin/pg_restore', 'bin/psql'],
    'darwin-x64': ['bin/pg_dump', 'bin/pg_restore', 'bin/psql'],
    'darwin-arm64': ['bin/pg_dump', 'bin/pg_restore', 'bin/psql'],
    'win-x64': ['bin/pg_dump.exe', 'bin/pg_restore.exe', 'bin/psql.exe']
  },
  mariadb: {
    'linux-x64': ['bin/mariadb-dump', 'bin/mysqldump', 'bin/mariadb', 'bin/mysql'],
    'win-x64': ['bin/mariadb-dump.exe', 'bin/mysqldump.exe', 'bin/mariadb.exe', 'bin/mysql.exe']
  },
  '7zip': {
    'linux-x64': ['7zz'],
    'linux-arm64': ['7zz'],
    'darwin-arm64': ['7zz'],
    'win-x64': ['7z.exe']
  }
}

export const DRIVER_DISPLAY_NAMES: Record<DriverToolId, string> = {
  sqlpackage: 'Microsoft SqlPackage (.bacpac)',
  mariadb: 'MariaDB client (mariadb-dump)',
  postgresql: 'PostgreSQL client (pg_dump)',
  'mongodb-database-tools': 'MongoDB Database Tools',
  '7zip': '7-Zip'
}

export function currentDriverPlatform(
  nodePlatform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): DriverMirrorPlatform | null {
  if (nodePlatform === 'linux' && arch === 'x64') return 'linux-x64'
  if (nodePlatform === 'linux' && (arch === 'arm64' || arch === 'aarch64')) return 'linux-arm64'
  if (nodePlatform === 'darwin' && arch === 'x64') return 'darwin-x64'
  if (nodePlatform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
  if (nodePlatform === 'win32' && arch === 'x64') return 'win-x64'
  return null
}

export function artifactForTool(
  toolId: DriverToolId,
  platform: DriverMirrorPlatform
): (typeof DRIVER_MIRROR_ARTIFACTS)[number] | null {
  return (
    DRIVER_MIRROR_ARTIFACTS.find((a) => a.toolId === toolId && a.platform === platform) ?? null
  )
}

export function toolDownloadUrl(
  toolId: DriverToolId,
  platform: DriverMirrorPlatform
): string | null {
  const artifact = artifactForTool(toolId, platform)
  return artifact ? driverMirrorUrl(artifact.relativePath) : null
}

export const ALL_DRIVER_TOOL_IDS = DriverToolIdSchema.options

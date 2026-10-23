import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  ALL_DRIVER_TOOL_IDS,
  DRIVER_BINARIES,
  DRIVER_DISPLAY_NAMES,
  artifactForTool,
  currentDriverPlatform,
  toolDownloadUrl,
  type DriverStatus,
  type DriverToolId
} from '../../shared/drivers'
import { toolExtractDir } from './paths'

function findBinary(extractRoot: string, relative: string): string | null {
  const parts = relative.split('/')
  const direct = join(extractRoot, ...parts)
  if (existsSync(direct)) {
    return direct
  }

  const walk = (dir: string, depth: number): string | null => {
    if (depth > 4) {
      return null
    }
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return null
    }
    for (const name of entries) {
      const full = join(dir, name)
      let isDir = false
      try {
        isDir = statSync(full).isDirectory()
      } catch {
        continue
      }
      if (!isDir) {
        continue
      }
      const candidate = join(full, ...parts)
      if (existsSync(candidate)) {
        return candidate
      }
      const deeper = walk(full, depth + 1)
      if (deeper) {
        return deeper
      }
    }
    return null
  }

  return walk(extractRoot, 0)
}

export function getDriverStatus(toolId: DriverToolId): DriverStatus {
  const platform = currentDriverPlatform()
  const artifact = platform ? artifactForTool(toolId, platform) : null
  const version = artifact?.version ?? 'unknown'
  const extractRoot =
    platform && artifact ? toolExtractDir(toolId, version, platform) : null
  const binaryRels = platform ? (DRIVER_BINARIES[toolId][platform] ?? []) : []

  const binaries = binaryRels.map((rel) => {
    const path = extractRoot ? findBinary(extractRoot, rel) : null
    return {
      name: rel.split('/').pop() ?? rel,
      path,
      found: Boolean(path)
    }
  })

  // MariaDB ships both legacy mysqldump and mariadb-dump — installed if any dump tool exists.
  const installed =
    toolId === 'mariadb'
      ? binaries.some((b) => b.found && b.name.replace(/\.exe$/, '').endsWith('dump'))
      : binaries.length > 0 && binaries.every((b) => b.found)

  return {
    toolId,
    name: DRIVER_DISPLAY_NAMES[toolId],
    version,
    platform: platform ?? `${process.platform}-${process.arch}`,
    availableForPlatform: Boolean(artifact),
    installed,
    installPath: installed ? extractRoot : null,
    binaries,
    downloadUrl: platform ? toolDownloadUrl(toolId, platform) : null,
    filename: artifact?.filename ?? null
  }
}

export function listDriverStatuses(): DriverStatus[] {
  return ALL_DRIVER_TOOL_IDS.map((id) => getDriverStatus(id))
}

/** Resolve an absolute path to a driver binary, or throw. */
export function requireDriverBinary(toolId: DriverToolId, binaryName: string): string {
  const status = getDriverStatus(toolId)
  const hit = status.binaries.find(
    (b) =>
      b.name === binaryName ||
      b.name === `${binaryName}.exe` ||
      (b.path != null && (b.path.endsWith(`/${binaryName}`) || b.path.endsWith(`\\${binaryName}`)))
  )
  if (!hit?.path) {
    throw new Error(
      `${DRIVER_DISPLAY_NAMES[toolId]} is not installed (missing ${binaryName}). Open Drivers and install it.`
    )
  }
  return hit.path
}

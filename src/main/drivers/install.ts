import { createHash } from 'crypto'
import { createReadStream, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import {
  artifactForTool,
  currentDriverPlatform,
  type DriverStatus,
  type DriverToolId
} from '../../shared/drivers'
import { driverMirrorUrl } from '../../shared/driversMirror'
import { getLogger } from '../logging/logger'
import { downloadToFile } from './download'
import { extractDriverArchive } from './extract'
import { toolDownloadPath, toolExtractDir, toolMetaPath } from './paths'
import { getDriverStatus } from './resolve'

export type DriverInstallProgress = {
  toolId: DriverToolId
  phase: 'download' | 'extract' | 'done'
  receivedBytes: number
  totalBytes: number | null
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', (chunk: string | Buffer) => {
      hash.update(chunk)
    })
    stream.on('error', reject)
    stream.on('end', () => resolve())
  })
  return hash.digest('hex')
}

/**
 * Download from the official mirror, extract, and record SHA-256 in meta.json.
 */
export async function installDriver(
  toolId: DriverToolId,
  onProgress?: (p: DriverInstallProgress) => void
): Promise<DriverStatus> {
  const log = getLogger('drivers')
  const platform = currentDriverPlatform()
  if (!platform) {
    throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`)
  }
  const artifact = artifactForTool(toolId, platform)
  if (!artifact) {
    throw new Error(`${toolId} is not available for ${platform}`)
  }

  const url = driverMirrorUrl(artifact.relativePath)
  const downloadPath = toolDownloadPath(toolId, artifact.version, platform)
  const extractDir = toolExtractDir(toolId, artifact.version, platform)
  const metaPath = toolMetaPath(toolId, artifact.version, platform)

  mkdirSync(dirname(downloadPath), { recursive: true })
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })

  log.info({ toolId, url }, 'Downloading driver')
  onProgress?.({
    toolId,
    phase: 'download',
    receivedBytes: 0,
    totalBytes: null
  })

  const tmpPath = `${downloadPath}.part`
  rmSync(tmpPath, { force: true })

  const { receivedBytes, totalBytes } = await downloadToFile(url, tmpPath, (p) => {
    onProgress?.({
      toolId,
      phase: 'download',
      receivedBytes: p.receivedBytes,
      totalBytes: p.totalBytes
    })
  })

  renameSync(tmpPath, downloadPath)
  const sha256 = await sha256File(downloadPath)

  onProgress?.({
    toolId,
    phase: 'extract',
    receivedBytes,
    totalBytes
  })

  await extractDriverArchive(downloadPath, extractDir)

  writeFileSync(
    metaPath,
    `${JSON.stringify(
      {
        toolId,
        version: artifact.version,
        platform,
        filename: artifact.filename,
        url,
        sha256,
        sizeBytes: receivedBytes,
        installedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  onProgress?.({
    toolId,
    phase: 'done',
    receivedBytes,
    totalBytes
  })

  const status = getDriverStatus(toolId)
  if (!status.installed) {
    throw new Error(
      `Installed ${toolId} but expected binaries were not found under ${extractDir}. Check archive layout.`
    )
  }
  log.info({ toolId, sha256, extractDir }, 'Driver installed')
  return status
}

export function readInstalledMeta(
  toolId: DriverToolId
): { sha256: string; version: string } | null {
  const platform = currentDriverPlatform()
  const artifact = platform ? artifactForTool(toolId, platform) : null
  if (!platform || !artifact) {
    return null
  }
  try {
    const raw = readFileSync(toolMetaPath(toolId, artifact.version, platform), 'utf8')
    const parsed = JSON.parse(raw) as { sha256?: string; version?: string }
    if (!parsed.sha256 || !parsed.version) {
      return null
    }
    return { sha256: parsed.sha256, version: parsed.version }
  } catch {
    return null
  }
}

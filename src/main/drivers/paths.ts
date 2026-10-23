import { app } from 'electron'
import { join } from 'path'
import type { DriverToolId } from '../../shared/drivers'
import type { DriverMirrorPlatform } from '../../shared/driversMirror'
import { artifactForTool } from '../../shared/drivers'

export function driversRoot(): string {
  return join(app.getPath('userData'), 'drivers')
}

export function toolInstallDir(
  toolId: DriverToolId,
  version: string,
  platform: DriverMirrorPlatform
): string {
  return join(driversRoot(), toolId, version, platform)
}

export function toolDownloadPath(
  toolId: DriverToolId,
  version: string,
  platform: DriverMirrorPlatform
): string {
  const artifact = artifactForTool(toolId, platform)
  const filename = artifact?.filename ?? `${toolId}.bin`
  return join(toolInstallDir(toolId, version, platform), 'download', filename)
}

export function toolExtractDir(
  toolId: DriverToolId,
  version: string,
  platform: DriverMirrorPlatform
): string {
  return join(toolInstallDir(toolId, version, platform), 'current')
}

export function toolMetaPath(
  toolId: DriverToolId,
  version: string,
  platform: DriverMirrorPlatform
): string {
  return join(toolInstallDir(toolId, version, platform), 'meta.json')
}

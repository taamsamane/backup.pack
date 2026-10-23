import { mkdirSync } from 'fs'
import { joinOsPath } from '../../shared/paths'
import { sanitizeTaskFolderName } from '../../shared/backup/sanitize'

export function taskRootPath(targetFolder: string, taskName: string): string {
  return joinOsPath(targetFolder, sanitizeTaskFolderName(taskName))
}

export function cyclesDir(taskRoot: string): string {
  return joinOsPath(taskRoot, 'cycles')
}

export function archivesDir(taskRoot: string): string {
  return joinOsPath(taskRoot, 'archives')
}

export function cycleDir(taskRoot: string, folderName: string): string {
  return joinOsPath(cyclesDir(taskRoot), folderName)
}

export function baselineDir(cyclePath: string): string {
  return joinOsPath(cyclePath, 'baseline')
}

export function changesDir(cyclePath: string): string {
  return joinOsPath(cyclePath, 'changes')
}

export function changeStampDir(cyclePath: string, stamp: string): string {
  return joinOsPath(changesDir(cyclePath), stamp)
}

export function manifestPath(cyclePath: string): string {
  return joinOsPath(cyclePath, 'manifest.json')
}

export function ensureTaskLayout(taskRoot: string): void {
  mkdirSync(cyclesDir(taskRoot), { recursive: true })
  mkdirSync(archivesDir(taskRoot), { recursive: true })
}

export function formatChangeStamp(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  const ss = String(now.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${hh}${mm}${ss}Z`
}

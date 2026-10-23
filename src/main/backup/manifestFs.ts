import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { ManifestEntry } from '../../shared/backup/types'
import { manifestPath } from './layout'

export type CycleManifestFile = {
  version: 1
  updatedAt: string
  entries: ManifestEntry[]
}

export function readCycleManifest(cyclePath: string): CycleManifestFile {
  const path = manifestPath(cyclePath)
  if (!existsSync(path)) {
    return { version: 1, updatedAt: new Date(0).toISOString(), entries: [] }
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as CycleManifestFile
  return {
    version: 1,
    updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
    entries: Array.isArray(raw.entries) ? raw.entries : []
  }
}

export function writeCycleManifest(cyclePath: string, entries: ManifestEntry[], now: Date): void {
  const file: CycleManifestFile = {
    version: 1,
    updatedAt: now.toISOString(),
    entries
  }
  writeFileSync(manifestPath(cyclePath), `${JSON.stringify(file, null, 2)}\n`, 'utf8')
}

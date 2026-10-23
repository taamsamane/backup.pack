import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { diffManifests } from '../../shared/backup/changeDetect'
import { isExcluded } from '../../shared/backup/exclude'
import type { BackupPlan, ManifestEntry } from '../../shared/backup/types'
import type { ResolvedProfile } from '../profiles/testers/types'
import {
  baselineDir,
  changeStampDir,
  changesDir,
  cycleDir,
  formatChangeStamp
} from './layout'
import { readCycleManifest, writeCycleManifest } from './manifestFs'
import {
  getSourceAdapter,
  remoteFileToManifestEntry,
  resolveRemoteRoot,
  type RemoteFileInfo
} from './sources'

export type TransferResult = {
  bytes: number
  fileCount: number
  added: number
  changed: number
  deleted: number
  unchanged: number
  changeStamp: string | null
  cycleFolderName: string
  lines: string[]
}

/**
 * List remote files, apply excludes, download into baseline or changes/, update manifest.
 */
export async function transferFromSource(input: {
  profile: ResolvedProfile
  plan: BackupPlan
  taskRoot: string
  cycleFolderName: string
  excludePatterns: string[]
  now: Date
  mode: 'baseline' | 'changes'
}): Promise<TransferResult> {
  const adapter = getSourceAdapter(input.profile.type)
  if (!adapter) {
    throw new Error(`No source adapter for profile type ${input.profile.type}`)
  }

  const remoteRoot = resolveRemoteRoot(input.profile)
  const listed = await adapter.listFiles(input.profile, remoteRoot)
  const included = listed.files.filter((f) => !isExcluded(f.relativePath, input.excludePatterns))
  const lines = [
    `source=${adapter.kind}`,
    `remoteRoot=${listed.remoteRoot}`,
    `listed=${listed.files.length}`,
    `afterExclude=${included.length}`
  ]

  const currentEntries = included.map(remoteFileToManifestEntry)
  const cyclePath = cycleDir(input.taskRoot, input.cycleFolderName)
  mkdirSync(baselineDir(cyclePath), { recursive: true })
  mkdirSync(changesDir(cyclePath), { recursive: true })

  let bytes = 0
  let fileCount = 0
  let changeStamp: string | null = null
  let added = 0
  let changed = 0
  let deleted = 0
  let unchanged = 0

  if (input.mode === 'baseline') {
    const dest = baselineDir(cyclePath)
    const downloaded = await adapter.downloadFiles(input.profile, included, dest)
    bytes = downloaded.bytes
    fileCount = downloaded.fileCount
    added = included.length
    writeCycleManifest(cyclePath, currentEntries, input.now)
    lines.push(`baselineFiles=${fileCount}`, `bytes=${bytes}`)
  } else {
    const previous = readCycleManifest(cyclePath).entries
    const diff = diffManifests(previous, currentEntries)
    added = diff.added.length
    changed = diff.changed.length
    deleted = diff.deleted.length
    unchanged = diff.unchanged

    const toFetchPaths = new Set([
      ...diff.added.map((e) => e.path),
      ...diff.changed.map((e) => e.path)
    ])
    const toFetch: RemoteFileInfo[] = included.filter((f) => toFetchPaths.has(f.relativePath))

    changeStamp = formatChangeStamp(input.now)
    const dest = changeStampDir(cyclePath, changeStamp)
    mkdirSync(dest, { recursive: true })

    if (toFetch.length > 0) {
      const downloaded = await adapter.downloadFiles(input.profile, toFetch, dest)
      bytes = downloaded.bytes
      fileCount = downloaded.fileCount
    }

    writeFileSync(
      join(dest, 'deleted.json'),
      `${JSON.stringify(
        {
          deleted: diff.deleted.map((e) => e.path),
          at: input.now.toISOString()
        },
        null,
        2
      )}\n`,
      'utf8'
    )

    // Merge: previous present minus deleted, plus added/changed
    const nextMap = new Map<string, ManifestEntry>()
    for (const e of previous.filter((x) => x.state === 'present')) {
      nextMap.set(e.path, e)
    }
    for (const e of diff.deleted) {
      nextMap.delete(e.path)
    }
    for (const e of [...diff.added, ...diff.changed]) {
      nextMap.set(e.path, e)
    }
    writeCycleManifest(cyclePath, [...nextMap.values()], input.now)
    lines.push(
      `changeStamp=${changeStamp}`,
      `added=${added}`,
      `changed=${changed}`,
      `deleted=${deleted}`,
      `unchanged=${unchanged}`,
      `downloaded=${fileCount}`,
      `bytes=${bytes}`
    )
  }

  return {
    bytes,
    fileCount,
    added,
    changed,
    deleted,
    unchanged,
    changeStamp,
    cycleFolderName: input.cycleFolderName,
    lines
  }
}

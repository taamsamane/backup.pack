import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ManifestEntry } from '../../shared/backup/types'
import type { ResolvedProfile } from '../profiles/testers/types'
import { dumpDatabase } from './db/dump'
import {
  baselineDir,
  changeStampDir,
  changesDir,
  cycleDir,
  formatChangeStamp
} from './layout'
import { readCycleManifest, writeCycleManifest } from './manifestFs'
import type { TransferResult } from './transfer'

/**
 * Database dump into cycle baseline (or changes stamp). Always a new dump file;
 * change detection compares dump size/mtime via manifest.
 */
export async function transferDatabaseDump(input: {
  profile: ResolvedProfile
  taskRoot: string
  cycleFolderName: string
  now: Date
  mode: 'baseline' | 'changes'
}): Promise<TransferResult> {
  const cyclePath = cycleDir(input.taskRoot, input.cycleFolderName)
  mkdirSync(baselineDir(cyclePath), { recursive: true })
  mkdirSync(changesDir(cyclePath), { recursive: true })

  let dest: string
  let changeStamp: string | null = null
  if (input.mode === 'baseline') {
    dest = baselineDir(cyclePath)
  } else {
    changeStamp = formatChangeStamp(input.now)
    dest = changeStampDir(cyclePath, changeStamp)
    mkdirSync(dest, { recursive: true })
  }

  const dump = await dumpDatabase(input.profile, dest)
  const entry: ManifestEntry = {
    path: dump.relativePath,
    size: dump.bytes,
    mtime: input.now.toISOString(),
    hash: null,
    etag: null,
    state: 'present'
  }

  if (input.mode === 'baseline') {
    writeCycleManifest(cyclePath, [entry], input.now)
  } else {
    const previous = readCycleManifest(cyclePath).entries.filter((e) => e.state === 'present')
    writeFileSync(
      join(dest, 'deleted.json'),
      `${JSON.stringify({ deleted: previous.map((e) => e.path), at: input.now.toISOString() }, null, 2)}\n`,
      'utf8'
    )
    writeCycleManifest(cyclePath, [entry], input.now)
  }

  return {
    bytes: dump.bytes,
    fileCount: dump.fileCount,
    added: 1,
    changed: 0,
    deleted: input.mode === 'changes' ? 1 : 0,
    unchanged: 0,
    changeStamp,
    cycleFolderName: input.cycleFolderName,
    lines: dump.lines
  }
}

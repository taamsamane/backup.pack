import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { dirname, join, normalize, relative, resolve, sep } from 'path'

export type PointInTimeFile = {
  /** Relative path using forward slashes */
  path: string
  absolutePath: string
  size: number
  source: 'baseline' | 'changes'
  changeStamp: string | null
}

export type PointInTimeSnapshot = {
  files: PointInTimeFile[]
  deletedPaths: string[]
  changeStamps: string[]
  asOfStamp: string | null
}

function toPosixRel(root: string, absolute: string): string {
  return relative(root, absolute).split(sep).join('/')
}

/**
 * Resolve `relativePath` under `root`, rejecting `..` / absolute escapes.
 */
export function safePathUnder(root: string, relativePath: string): string {
  const cleaned = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!cleaned || cleaned.includes('\0')) {
    throw new Error('Invalid relative path')
  }
  const rootResolved = resolve(root)
  const target = resolve(rootResolved, cleaned)
  const prefix = rootResolved.endsWith(sep) ? rootResolved : `${rootResolved}${sep}`
  if (target !== rootResolved && !target.startsWith(prefix)) {
    throw new Error(`Path escapes root: ${relativePath}`)
  }
  return target
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }
  const out: string[] = []
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full)
      } else if (st.isFile()) {
        out.push(full)
      }
    }
  }
  walk(dir)
  return out
}

function readDeletedJson(stampDir: string): string[] {
  const path = join(stampDir, 'deleted.json')
  if (!existsSync(path)) {
    return []
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { deleted?: unknown }
    if (!Array.isArray(raw.deleted)) {
      return []
    }
    return raw.deleted.filter((p): p is string => typeof p === 'string')
  } catch {
    return []
  }
}

/** List change stamp folder names under cycle/changes, ascending. */
export function listChangeStamps(cyclePath: string): string[] {
  const changesRoot = join(cyclePath, 'changes')
  if (!existsSync(changesRoot)) {
    return []
  }
  return readdirSync(changesRoot)
    .filter((name) => {
      try {
        return statSync(join(changesRoot, name)).isDirectory()
      } catch {
        return false
      }
    })
    .sort()
}

/**
 * Build the effective file set at a point in time:
 * baseline, then each changes/<stamp> ≤ asOfStamp (or all if omitted),
 * applying deleted.json removals per stamp.
 */
export function buildPointInTimeSnapshot(
  cyclePath: string,
  asOfStamp?: string | null
): PointInTimeSnapshot {
  const allStamps = listChangeStamps(cyclePath)
  const stamps = asOfStamp
    ? allStamps.filter((s) => s <= asOfStamp)
    : allStamps

  const map = new Map<string, PointInTimeFile>()
  const deletedAccum: string[] = []

  const baseline = join(cyclePath, 'baseline')
  for (const abs of walkFiles(baseline)) {
    const rel = toPosixRel(baseline, abs)
    const st = statSync(abs)
    map.set(rel, {
      path: rel,
      absolutePath: abs,
      size: st.size,
      source: 'baseline',
      changeStamp: null
    })
  }

  for (const stamp of stamps) {
    const stampDir = join(cyclePath, 'changes', stamp)
    const deleted = readDeletedJson(stampDir)
    for (const rel of deleted) {
      map.delete(rel.replace(/\\/g, '/'))
      deletedAccum.push(rel.replace(/\\/g, '/'))
    }
    for (const abs of walkFiles(stampDir)) {
      const rel = toPosixRel(stampDir, abs)
      if (rel === 'deleted.json' || rel.endsWith('/deleted.json')) {
        continue
      }
      const st = statSync(abs)
      map.set(rel, {
        path: rel,
        absolutePath: abs,
        size: st.size,
        source: 'changes',
        changeStamp: stamp
      })
    }
  }

  return {
    files: [...map.values()].sort((a, b) => a.path.localeCompare(b.path)),
    deletedPaths: [...new Set(deletedAccum)].sort(),
    changeStamps: allStamps,
    asOfStamp: asOfStamp ?? null
  }
}

/**
 * Copy the point-in-time snapshot into destRoot (created if missing).
 * Optionally filter to a subset of relative paths.
 */
export function restoreSnapshotToFolder(input: {
  snapshot: PointInTimeSnapshot
  destRoot: string
  paths?: string[] | null
}): { fileCount: number; bytesTotal: number; deletedSkipped: number } {
  const destRoot = resolve(input.destRoot)
  mkdirSync(destRoot, { recursive: true })

  const allow =
    input.paths && input.paths.length > 0
      ? new Set(input.paths.map((p) => p.replace(/\\/g, '/')))
      : null

  let fileCount = 0
  let bytesTotal = 0

  for (const file of input.snapshot.files) {
    if (allow && !allow.has(file.path)) {
      continue
    }
    const dest = safePathUnder(destRoot, file.path)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(file.absolutePath, dest)
    fileCount += 1
    bytesTotal += file.size
  }

  return {
    fileCount,
    bytesTotal,
    deletedSkipped: input.snapshot.deletedPaths.length
  }
}

/** Write a tiny fixture tree for tests. */
export function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const full = safePathUnder(root, relativePath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content, 'utf8')
}

export function removePathQuiet(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

export function normalizeRelativeKey(path: string): string {
  return normalize(path).split(sep).join('/')
}

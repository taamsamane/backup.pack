import type { ManifestDiff, ManifestEntry } from './types'

function keyOf(entry: ManifestEntry): string {
  return entry.path
}

function fingerprint(entry: ManifestEntry): string {
  return [entry.hash ?? '', entry.etag ?? '', entry.size ?? '', entry.mtime ?? ''].join('|')
}

/**
 * Diff previous vs current present-file sets.
 * Entries with state=deleted in `current` are treated as deletions.
 */
export function diffManifests(
  previous: ManifestEntry[],
  current: ManifestEntry[]
): ManifestDiff {
  const prevMap = new Map(
    previous.filter((e) => e.state === 'present').map((e) => [keyOf(e), e])
  )
  const currPresent = current.filter((e) => e.state === 'present')
  const currDeleted = new Set(
    current.filter((e) => e.state === 'deleted').map((e) => keyOf(e))
  )
  const currMap = new Map(currPresent.map((e) => [keyOf(e), e]))

  const added: ManifestEntry[] = []
  const changed: ManifestEntry[] = []
  let unchanged = 0

  for (const [path, entry] of currMap) {
    const prev = prevMap.get(path)
    if (!prev) {
      added.push(entry)
      continue
    }
    if (fingerprint(prev) !== fingerprint(entry)) {
      changed.push(entry)
    } else {
      unchanged += 1
    }
  }

  const deleted: ManifestEntry[] = []
  for (const [path, entry] of prevMap) {
    if (!currMap.has(path) || currDeleted.has(path)) {
      deleted.push({
        ...entry,
        state: 'deleted'
      })
    }
  }

  return { added, changed, deleted, unchanged }
}

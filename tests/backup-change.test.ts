import { describe, expect, it } from 'vitest'
import { diffManifests } from '../src/shared/backup/changeDetect'
import type { ManifestEntry } from '../src/shared/backup/types'

const present = (path: string, hash: string, size = 10): ManifestEntry => ({
  path,
  size,
  mtime: '2026-10-22T00:00:00.000Z',
  hash,
  etag: null,
  state: 'present'
})

describe('diffManifests', () => {
  it('detects added, changed, deleted, and unchanged', () => {
    const previous = [present('a.txt', 'h1'), present('b.txt', 'h2'), present('c.txt', 'h3')]
    const current = [present('a.txt', 'h1'), present('b.txt', 'h2-changed'), present('d.txt', 'h4')]
    const diff = diffManifests(previous, current)
    expect(diff.added.map((e) => e.path)).toEqual(['d.txt'])
    expect(diff.changed.map((e) => e.path)).toEqual(['b.txt'])
    expect(diff.deleted.map((e) => e.path).sort()).toEqual(['c.txt'])
    expect(diff.unchanged).toBe(1)
  })
})

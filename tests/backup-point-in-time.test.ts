import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildPointInTimeSnapshot,
  restoreSnapshotToFolder,
  safePathUnder,
  writeFixtureFile
} from '../src/shared/backup/pointInTime'

let roots: string[] = []

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bh-pit-'))
  roots.push(dir)
  return dir
}

afterEach(() => {
  for (const r of roots) {
    rmSync(r, { recursive: true, force: true })
  }
  roots = []
})

describe('safePathUnder', () => {
  it('rejects path traversal', () => {
    const root = tempRoot()
    expect(() => safePathUnder(root, '../outside.txt')).toThrow(/escapes/)
  })
})

describe('buildPointInTimeSnapshot', () => {
  it('applies baseline, changes, and deleted.json in stamp order', () => {
    const cycle = join(tempRoot(), 'cycle')
    writeFixtureFile(cycle, 'baseline/a.txt', 'A0')
    writeFixtureFile(cycle, 'baseline/b.txt', 'B0')
    writeFixtureFile(cycle, 'baseline/c.txt', 'C0')

    const stamp1 = '20261022T100000Z'
    writeFixtureFile(cycle, `changes/${stamp1}/b.txt`, 'B1')
    mkdirSync(join(cycle, 'changes', stamp1), { recursive: true })
    writeFileSync(
      join(cycle, 'changes', stamp1, 'deleted.json'),
      JSON.stringify({ deleted: ['c.txt'], at: '2026-10-22T10:00:00.000Z' }),
      'utf8'
    )

    const stamp2 = '20261022T110000Z'
    writeFixtureFile(cycle, `changes/${stamp2}/d.txt`, 'D2')

    const latest = buildPointInTimeSnapshot(cycle)
    expect(latest.changeStamps).toEqual([stamp1, stamp2])
    expect(latest.files.map((f) => f.path).sort()).toEqual(['a.txt', 'b.txt', 'd.txt'])
    expect(latest.files.find((f) => f.path === 'b.txt')?.source).toBe('changes')
    expect(latest.deletedPaths).toContain('c.txt')

    const asOf = buildPointInTimeSnapshot(cycle, stamp1)
    expect(asOf.files.map((f) => f.path).sort()).toEqual(['a.txt', 'b.txt'])
    expect(asOf.files.find((f) => f.path === 'd.txt')).toBeUndefined()

    const dest = join(tempRoot(), 'out')
    const result = restoreSnapshotToFolder({ snapshot: latest, destRoot: dest })
    expect(result.fileCount).toBe(3)
    expect(readFileSync(join(dest, 'a.txt'), 'utf8')).toBe('A0')
    expect(readFileSync(join(dest, 'b.txt'), 'utf8')).toBe('B1')
    expect(readFileSync(join(dest, 'd.txt'), 'utf8')).toBe('D2')
  })
})

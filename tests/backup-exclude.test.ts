import { describe, expect, it } from 'vitest'
import { isExcluded, matchExcludePattern } from '../src/shared/backup/exclude'
import { joinRemotePath, normalizeRemotePath, toRelativeRemotePath } from '../src/shared/backup/remotePath'

describe('exclude patterns', () => {
  it('matches exact folder prefixes', () => {
    expect(matchExcludePattern('node_modules/pkg/index.js', 'node_modules')).toBe(true)
    expect(matchExcludePattern('src/index.js', 'node_modules')).toBe(false)
  })

  it('matches globs', () => {
    expect(matchExcludePattern('tmp/a.tmp', '*.tmp')).toBe(false)
    expect(matchExcludePattern('a.tmp', '*.tmp')).toBe(true)
    expect(matchExcludePattern('logs/app.log', '**/*.log')).toBe(true)
    expect(matchExcludePattern('deep/nested/x.cache', '**/*.cache')).toBe(true)
  })

  it('isExcluded ORs patterns', () => {
    expect(isExcluded('a.tmp', ['*.tmp', 'node_modules'])).toBe(true)
    expect(isExcluded('readme.md', ['*.tmp', 'node_modules'])).toBe(false)
  })
})

describe('remotePath helpers', () => {
  it('normalizes and joins remote paths', () => {
    expect(normalizeRemotePath('/var//www/')).toBe('/var/www')
    expect(joinRemotePath('/var/www', 'html/index.html')).toBe('/var/www/html/index.html')
    expect(joinRemotePath('.', 'uploads/a.txt')).toBe('uploads/a.txt')
  })

  it('computes relative paths from root', () => {
    expect(toRelativeRemotePath('/var/www', '/var/www/html/a.txt')).toBe('html/a.txt')
    expect(toRelativeRemotePath('.', 'uploads/a.txt')).toBe('uploads/a.txt')
  })
})

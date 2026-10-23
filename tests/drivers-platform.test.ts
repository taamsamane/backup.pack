import { describe, expect, it } from 'vitest'
import {
  ALL_DRIVER_TOOL_IDS,
  artifactForTool,
  currentDriverPlatform,
  toolDownloadUrl
} from '../src/shared/drivers'

describe('currentDriverPlatform', () => {
  it('maps linux x64', () => {
    expect(currentDriverPlatform('linux', 'x64')).toBe('linux-x64')
  })

  it('maps darwin arm64', () => {
    expect(currentDriverPlatform('darwin', 'arm64')).toBe('darwin-arm64')
  })

  it('returns null for unsupported', () => {
    expect(currentDriverPlatform('freebsd', 'x64')).toBeNull()
  })
})

describe('driver mirror artifacts', () => {
  it('has sqlpackage for linux-x64', () => {
    const a = artifactForTool('sqlpackage', 'linux-x64')
    expect(a?.filename).toContain('sqlpackage')
    expect(toolDownloadUrl('sqlpackage', 'linux-x64')).toMatch(
      /^https:\/\/drivers\.taam\.shop\/drivers\/sqlpackage\//
    )
  })

  it('lists all tool ids', () => {
    expect(ALL_DRIVER_TOOL_IDS).toContain('mariadb')
    expect(ALL_DRIVER_TOOL_IDS).toContain('postgresql')
  })
})

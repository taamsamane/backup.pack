import { describe, expect, it } from 'vitest'
import { IpcChannels } from '../src/shared/ipc/channels'

describe('IpcChannels', () => {
  it('uses namespaced channel names', () => {
    for (const value of Object.values(IpcChannels)) {
      expect(value).toMatch(/^[a-z]+:[a-zA-Z]+$/)
    }
  })

  it('has unique values', () => {
    const values = Object.values(IpcChannels)
    expect(new Set(values).size).toBe(values.length)
  })
})

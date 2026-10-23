import { describe, expect, it } from 'vitest'
import { AppSettingsSchema, DEFAULT_SETTINGS } from '../src/shared/settings'
import {
  SettingsSetManyPayloadSchema,
  SettingsSetPayloadSchema
} from '../src/shared/ipc/schemas'

describe('AppSettingsSchema', () => {
  it('accepts defaults', () => {
    expect(AppSettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
  })

  it('rejects invalid concurrency', () => {
    expect(() =>
      AppSettingsSchema.parse({ ...DEFAULT_SETTINGS, globalConcurrency: 0 })
    ).toThrow()
  })

  it('validates settings set payload', () => {
    const parsed = SettingsSetPayloadSchema.parse({
      key: 'theme',
      value: 'dark'
    })
    expect(parsed.key).toBe('theme')
  })

  it('validates partial settings patch', () => {
    const parsed = SettingsSetManyPayloadSchema.parse({
      values: { logLevel: 'debug', closeToTray: false }
    })
    expect(parsed.values.logLevel).toBe('debug')
    expect(parsed.values.closeToTray).toBe(false)
  })

  it('rejects unknown settings keys in set-many', () => {
    expect(() =>
      SettingsSetManyPayloadSchema.parse({
        values: { notARealKey: true }
      })
    ).toThrow()
  })
})

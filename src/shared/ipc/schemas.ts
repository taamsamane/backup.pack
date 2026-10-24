import { z } from 'zod'
import { AppSettingsSchema } from '../settings'

/** Empty payload for invoke channels that take no arguments. */
export const EmptyPayloadSchema = z.union([
  z.undefined(),
  z.null(),
  z.object({}).strict()
])

export const SettingsKeySchema = z.enum([
  'theme',
  'language',
  'minimizeToTray',
  'launchOnLogin',
  'closeToTray',
  'globalConcurrency',
  'logLevel',
  'notifyOnSuccess',
  'notifyOnFailure',
  'checkUpdatesOnStartup'
])

export const SettingsGetPayloadSchema = z.object({
  key: SettingsKeySchema
})

export const SettingsSetPayloadSchema = z.object({
  key: SettingsKeySchema,
  value: z.unknown()
})

export const SettingsSetManyPayloadSchema = z.object({
  values: AppSettingsSchema.partial().strict()
})

export const AppInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  electron: z.string(),
  chrome: z.string(),
  node: z.string(),
  platform: z.string(),
  arch: z.string(),
  isPackaged: z.boolean()
})

export const AppPathsSchema = z.object({
  userData: z.string(),
  logs: z.string(),
  database: z.string(),
  drivers: z.string()
})

export const DbHealthSchema = z.object({
  ok: z.boolean(),
  path: z.string(),
  migrationCount: z.number().int().nonnegative(),
  schemaVersion: z.string().nullable(),
  tableCounts: z.record(z.string(), z.number().int().nonnegative())
})

export type AppInfo = z.infer<typeof AppInfoSchema>
export type AppPaths = z.infer<typeof AppPathsSchema>
export type DbHealth = z.infer<typeof DbHealthSchema>
export type SettingsGetPayload = z.infer<typeof SettingsGetPayloadSchema>
export type SettingsSetPayload = z.infer<typeof SettingsSetPayloadSchema>
export type SettingsSetManyPayload = z.infer<typeof SettingsSetManyPayloadSchema>

import { z } from 'zod'

export const ThemeSchema = z.enum(['system', 'light', 'dark'])
export type Theme = z.infer<typeof ThemeSchema>

export const LogLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
export type LogLevel = z.infer<typeof LogLevelSchema>

export const AppSettingsSchema = z
  .object({
    theme: ThemeSchema,
    language: z.string().min(2).max(16),
    minimizeToTray: z.boolean(),
    launchOnLogin: z.boolean(),
    closeToTray: z.boolean(),
    globalConcurrency: z.number().int().min(1).max(16),
    logLevel: LogLevelSchema
  })
  .strict()

export type AppSettings = z.infer<typeof AppSettingsSchema>

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  minimizeToTray: true,
  launchOnLogin: false,
  closeToTray: true,
  globalConcurrency: 2,
  logLevel: 'info'
}

export const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]

import { z } from 'zod'
import { AppLocaleSchema } from './i18n'

export const ThemeSchema = z.enum(['system', 'light', 'dark'])
export type Theme = z.infer<typeof ThemeSchema>

export const LogLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
export type LogLevel = z.infer<typeof LogLevelSchema>

export const LanguageSchema = AppLocaleSchema
export type Language = z.infer<typeof LanguageSchema>

export const AppSettingsSchema = z
  .object({
    theme: ThemeSchema,
    language: LanguageSchema,
    minimizeToTray: z.boolean(),
    launchOnLogin: z.boolean(),
    closeToTray: z.boolean(),
    globalConcurrency: z.number().int().min(1).max(16),
    logLevel: LogLevelSchema,
    notifyOnSuccess: z.boolean(),
    notifyOnFailure: z.boolean(),
    checkUpdatesOnStartup: z.boolean()
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
  logLevel: 'info',
  notifyOnSuccess: false,
  notifyOnFailure: true,
  checkUpdatesOnStartup: true
}

export const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]

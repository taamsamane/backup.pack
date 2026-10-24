import { z } from 'zod'

/** Supported UI locales. Add more codes here as translations ship. */
export const AppLocaleSchema = z.enum(['en', 'fa'])
export type AppLocale = z.infer<typeof AppLocaleSchema>

/** Locales that use right-to-left layout (Arabic script family, etc.). */
export const RTL_LOCALES: ReadonlySet<AppLocale> = new Set(['fa'])

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale as AppLocale)
}

export function normalizeAppLocale(value: string | null | undefined): AppLocale {
  const parsed = AppLocaleSchema.safeParse(value)
  return parsed.success ? parsed.data : 'en'
}

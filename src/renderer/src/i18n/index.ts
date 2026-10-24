import { computed, ref } from 'vue'
import {
  isRtlLocale,
  normalizeAppLocale,
  type AppLocale
} from '../../../shared/i18n'
import { en, type MessageTree } from './locales/en'
import { fa } from './locales/fa'

const catalogs: Record<AppLocale, MessageTree> = { en, fa }

const locale = ref<AppLocale>('en')

type PathImpl<T, Key extends keyof T> = Key extends string
  ? T[Key] extends Record<string, unknown>
    ? `${Key}.${PathImpl<T[Key], keyof T[Key]>}`
    : `${Key}`
  : never

export type MessageKey = PathImpl<MessageTree, keyof MessageTree>

function lookup(tree: MessageTree, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = tree
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') {
      return undefined
    }
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

export function t(key: MessageKey | string, vars?: Record<string, string | number>): string {
  const fromLocale = lookup(catalogs[locale.value], key)
  const fromEn = lookup(catalogs.en, key)
  let text = fromLocale ?? fromEn ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}

export function applyDocumentLocale(next: string): AppLocale {
  const normalized = normalizeAppLocale(next)
  locale.value = normalized
  const root = document.documentElement
  root.lang = normalized
  root.dir = isRtlLocale(normalized) ? 'rtl' : 'ltr'
  root.dataset.locale = normalized
  return normalized
}

export function useI18n() {
  return {
    locale: computed(() => locale.value),
    isRtl: computed(() => isRtlLocale(locale.value)),
    t,
    setLocale: applyDocumentLocale
  }
}

export { locale }

// ============================================================
// src/i18n/request.ts
// Locale detection for next-intl (Sprint 8).
//
// ACTIVATE: This file requires `npm install next-intl` before use.
// See src/i18n/README.md for setup checklist.
// ============================================================

// Supported locales
export const locales = ['en-US', 'en-CA', 'en-GB', 'en-AU', 'fr-CA', 'fr-FR', 'de-DE', 'pt-BR', 'es-MX', 'ar-SA', 'zh-CN'] as const
export type SupportedLocale = typeof locales[number]
export const defaultLocale: SupportedLocale = 'en-US'

/**
 * Resolve locale from request headers.
 * Resolution order:
 *   1. x-pipefield-locale header (set by middleware from project.locale)
 *   2. Accept-Language header (best match)
 *   3. defaultLocale ('en-US')
 *
 * Called by next-intl's getRequestConfig in i18n.ts (next.js root).
 */
export function resolveLocale(headers: Headers): SupportedLocale {
  // 1. Project/org locale set by middleware
  const explicit = headers.get('x-pipefield-locale')
  if (explicit && (locales as readonly string[]).includes(explicit)) {
    return explicit as SupportedLocale
  }

  // 2. Accept-Language best match
  const acceptLang = headers.get('accept-language')
  if (acceptLang) {
    for (const lang of acceptLang.split(',').map(l => l.split(';')[0].trim())) {
      // Exact match
      if ((locales as readonly string[]).includes(lang)) return lang as SupportedLocale
      // Language-only match (e.g. 'fr' → 'fr-CA')
      const prefix = lang.split('-')[0]
      const match = locales.find(l => l.startsWith(prefix + '-'))
      if (match) return match
    }
  }

  return defaultLocale
}

/**
 * Load message file for a given locale.
 * Falls back to en-US if locale-specific file is missing.
 */
export async function loadMessages(locale: SupportedLocale): Promise<Record<string, unknown>> {
  try {
    return (await import(`../../messages/${locale}.json`)) as Record<string, unknown>
  } catch {
    // Fallback to en-US for locales without a complete message file
    return (await import('../../messages/en-US.json')) as Record<string, unknown>
  }
}

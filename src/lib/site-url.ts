// ============================================================
// site-url.ts — canonical site URL helper
//
// Single source of truth for the production URL.
// Import this wherever you need an absolute URL (canonical,
// og:url, sitemap, robots, email links, etc.).
//
// NEXT_PUBLIC_APP_URL must be set in Vercel → Settings →
// Environment Variables for production builds.
// ============================================================

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://pipefield-os.com'

/**
 * Returns an absolute URL for the given path.
 * @example siteUrl('/blog/my-post') → 'https://pipefield-os.com/blog/my-post'
 */
export function siteUrl(path: string = '/'): string {
  const base = SITE_URL.replace(/\/$/, '')
  const p    = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

/**
 * Returns the correct base URL for internal API calls.
 *
 * - In a browser (web): relative paths work fine  → returns ""
 * - In Capacitor (native iOS/Android): the WebView loads from
 *   capacitor://localhost so relative /api/... paths would 404.
 *   We prefix with the live Vercel URL so API calls go to the server.
 */
export function apiUrl(path: string): string {
  if (
    typeof window !== 'undefined' &&
    (window as typeof window & { Capacitor?: { isNativePlatform(): boolean } }).Capacitor?.isNativePlatform()
  ) {
    return `https://pipefield-os.vercel.app${path}`
  }
  return path
}

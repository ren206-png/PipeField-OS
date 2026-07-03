// ============================================================
// useNativeApp — Capacitor native plugin integration
// Runs on iOS/Android; safely no-ops in the browser.
// Import and call once in your root layout or a top-level component.
// ============================================================
'use client'
import { useEffect } from 'react'

export function useNativeApp() {
  useEffect(() => {
    let cleanupFns: Array<() => void> = []

    async function init() {
      // Capacitor is only available inside the native shell
      const cap = (window as typeof window & { Capacitor?: { isNativePlatform(): boolean } }).Capacitor
      if (!cap?.isNativePlatform()) return

      // Dynamic imports so Next.js doesn't bundle these for the web build
      const [
        { SplashScreen },
        { StatusBar, Style },
        { App },
        { Haptics },
      ] = await Promise.all([
        import('@capacitor/splash-screen'),
        import('@capacitor/status-bar'),
        import('@capacitor/app'),
        import('@capacitor/haptics'),
      ])

      // ── Hide splash after app has loaded ─────────────────
      await SplashScreen.hide({ fadeOutDuration: 300 })

      // ── Dark status bar ───────────────────────────────────
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: '#0a0d12' })

      // ── Handle deep links (Supabase email confirmation) ───
      // pipefield://auth/callback?code=xxx
      const { remove } = await App.addListener('appUrlOpen', ({ url }) => {
        if (url.includes('/auth/callback') || url.includes('/auth/confirm')) {
          // Extract path after our custom scheme and push into the web router
          const path = url.replace(/^pipefield:\/\//, '/')
          window.location.href = path
        }
      })
      cleanupFns.push(remove)

      // ── Back button handling (Android) ────────────────────
      const { remove: removeBack } = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          App.exitApp()
        }
      })
      cleanupFns.push(removeBack)

      // Haptic feedback is now exposed via the useHaptics() hook
      // (src/hooks/useHaptics.ts) rather than a global window mutation.
      // This comment is intentional — Haptics is still imported above
      // for the back-button and URL-open listeners.
      void Haptics // keep the import used to avoid tree-shaking it away
    }

    init().catch(err => console.warn('[useNativeApp]', err))

    return () => {
      cleanupFns.forEach(fn => fn())
    }
  }, [])
}

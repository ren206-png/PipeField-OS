'use client'
// ============================================================
// useHaptics — typed haptic feedback hook
// Replaces the window.__haptic global with a proper hook.
// Safe to call on web (no-ops silently).
// Usage: const haptic = useHaptics(); haptic('light')
// ============================================================
import { useCallback } from 'react'

export type HapticStyle = 'light' | 'medium' | 'heavy'

export function useHaptics() {
  return useCallback((style: HapticStyle = 'light') => {
    // Dynamically import Capacitor Haptics — only available in native shell
    const cap = (window as typeof window & { Capacitor?: { isNativePlatform(): boolean } }).Capacitor
    if (!cap?.isNativePlatform()) return

    import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
      const styleMap: Record<HapticStyle, typeof ImpactStyle[keyof typeof ImpactStyle]> = {
        light:  ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy:  ImpactStyle.Heavy,
      }
      Haptics.impact({ style: styleMap[style] }).catch(() => {})
    }).catch(() => {})
  }, [])
}

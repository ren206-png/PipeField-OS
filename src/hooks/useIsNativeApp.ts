'use client'
// ============================================================
// useIsNativeApp — true inside the iOS/Android (Capacitor) app.
//
// layout.tsx sets <html data-native-app="ios|android"> before first paint.
// Used to keep purchases out of the store apps: Google Play and the App Store
// don't allow selling subscriptions in-app except through their own billing,
// so plans are bought on the website and the apps only show plan status.
// ============================================================
import { useEffect, useState } from 'react'

export function isNativeApp(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.hasAttribute('data-native-app')
}

export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false)
  useEffect(() => { setNative(isNativeApp()) }, [])
  return native
}

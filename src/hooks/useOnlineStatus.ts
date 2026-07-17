'use client'
// ============================================================
// useOnlineStatus — reactive online/offline connectivity state.
//
// Initialises from navigator.onLine (SSR-safe), then updates
// on browser online/offline events. Returns a stable boolean
// that components can use to render connectivity indicators.
// ============================================================
import { useEffect, useState } from 'react'

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    // Sync in case events fired before mount
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return isOnline
}

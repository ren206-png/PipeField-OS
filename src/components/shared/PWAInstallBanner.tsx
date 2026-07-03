'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'pwa_install_dismissed'

/** Detect iOS Safari (no beforeinstallprompt support) */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOSDevice, setIsIOSDevice] = useState(false)

  useEffect(() => {
    // Don't show if already installed or user dismissed before
    if (isInStandaloneMode()) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    const ios = isIOS()
    setIsIOSDevice(ios)

    if (ios) {
      // iOS: show manual "Add to Home Screen" instructions
      setShowBanner(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      dismiss()
    }
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div
      role="banner"
      aria-label="Install app"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-surface-800 border-t border-surface-700 px-4 py-3 text-sm shadow-lg"
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Orange pipe icon */}
        <span className="shrink-0 text-orange-500" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="8" width="16" height="4" rx="2" fill="currentColor" />
            <rect x="8" y="2" width="4" height="16" rx="2" fill="currentColor" />
          </svg>
        </span>
        <p className="text-surface-100 truncate">
          {isIOSDevice
            ? 'Install PipeField OS: tap the Share button then "Add to Home Screen"'
            : 'Install PipeField OS for offline access'}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isIOSDevice && (
          <button
            onClick={handleInstall}
            className="rounded bg-orange-500 px-3 py-1 font-medium text-white hover:bg-orange-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss install banner"
          className="rounded px-2 py-1 text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-500"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Turnstile failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

// Tokens are single-use: bump `resetKey` after every auth call that spent one.
export function Turnstile({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void
  resetKey: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          size: 'flexible',
          theme: 'dark',
          action: 'login',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          // Same fallback as a script load failure: never lock users out of
          // sign-in client-side; Supabase enforces CAPTCHA if it's turned on.
          'error-callback': () => onTokenRef.current('__load_failed__'),
        })
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          // Allow sign-in to proceed even if the widget can't load (e.g. ad blocker).
          // Supabase will reject the request if CAPTCHA is strictly required server-side.
          onTokenRef.current('__load_failed__')
        }
      })
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (resetKey === 0 || !widgetIdRef.current || !window.turnstile) return
    onTokenRef.current(null)
    window.turnstile.reset(widgetIdRef.current)
  }, [resetKey])

  if (!TURNSTILE_SITE_KEY) return null

  return (
    <div>
      <div ref={containerRef} className="min-h-[65px]" />
      {/* Load error is silent — user can still sign in without a token */}
    </div>
  )
}

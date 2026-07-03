'use client'
// ============================================================
// useHealthMonitor
// Polls /api/health every 60 seconds and exposes the result.
// Only runs in the browser (no SSR polling).
// ============================================================
import { useState, useEffect, useRef } from 'react'

interface HealthState {
  isHealthy: boolean
  lastChecked: Date | null
  latency: number | null
}

const POLL_INTERVAL_MS = 60_000

export function useHealthMonitor(): HealthState {
  const [state, setState] = useState<HealthState>({
    isHealthy: true,
    lastChecked: null,
    latency: null,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function check() {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      const data = await res.json()

      setState({
        isHealthy: res.ok && data.status === 'healthy',
        lastChecked: new Date(),
        latency: typeof data.latency === 'number' ? data.latency : null,
      })
    } catch {
      setState(prev => ({
        ...prev,
        isHealthy: false,
        lastChecked: new Date(),
      }))
    }
  }

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return

    check()

    timerRef.current = setInterval(check, POLL_INTERVAL_MS)

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  return state
}

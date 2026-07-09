'use client'
// ============================================================
// DashboardErrorFallback
// Shared UI for Next.js route-segment error.tsx files.
//
// - Renders a styled error card with a retry button
// - Logs to console (visible in browser DevTools)
// - Reports to /api/errors (fire-and-forget, never throws)
//
// Usage inside an error.tsx:
//   'use client'
//   import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback'
//   export default function Error({ error, reset }) {
//     return <DashboardErrorFallback error={error} reset={reset} label="Page Name" />
//   }
// ============================================================
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
  /** Human-readable label for the failing section, shown in the error panel */
  label?: string
}

export function DashboardErrorFallback({ error, reset, label }: Props) {
  useEffect(() => {
    // Log to browser console for DevTools visibility
    console.error(`[${label ?? 'Page'} Error]`, error)

    // Report to server-side error store (fire-and-forget)
    fetch('/api/errors', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message:   error.message,
        stack:     error.stack,
        url:       typeof window !== 'undefined' ? window.location.href : undefined,
        component: label,
        severity:  'error',
      }),
    }).catch(() => {
      // Never let error reporting crash the UI
    })
  }, [error, label])

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 max-w-md w-full">
        <AlertTriangle className="w-8 h-8 text-red-400 mb-3 mx-auto" />
        <h2 className="text-base font-semibold text-surface-100 mb-1">
          {label ? `Failed to load ${label}` : 'Something went wrong'}
        </h2>
        <p className="text-sm text-surface-500 mb-5">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {error.digest && (
          <p className="text-xs text-surface-600 mb-4 font-mono">ref: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-sm text-surface-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-sm text-surface-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}

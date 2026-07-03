'use client'
// Dashboard-group error boundary — catches errors that bubble up past
// the component-level ErrorBoundary in DashboardShell.
// Renders inside the shell so the sidebar / header stay usable.
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 max-w-md w-full">
        <AlertTriangle className="w-10 h-10 text-red-400 mb-3 mx-auto" />
        <h2 className="text-base font-semibold text-surface-100 mb-1">Page failed to load</h2>
        <p className="text-sm text-surface-500 mb-5">
          {error.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-sm text-surface-200 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  )
}

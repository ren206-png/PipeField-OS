'use client'
// Root-level error boundary — catches unhandled errors outside the dashboard group.
import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[RootError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-900 p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
      <h1 className="text-xl font-semibold text-surface-100 mb-2">Something went wrong</h1>
      <p className="text-sm text-surface-500 mb-6 max-w-sm">
        {error.message ?? 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-sm text-surface-200 transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Try again
      </button>
    </div>
  )
}

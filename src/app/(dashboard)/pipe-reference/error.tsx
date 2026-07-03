'use client'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="card p-12 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-400" />
        <div>
          <h2 className="text-lg font-semibold text-surface-100">Something went wrong</h2>
          <p className="text-sm text-surface-400 mt-1">{error.message}</p>
        </div>
        <button onClick={reset} className="btn-primary">Try again</button>
      </div>
    </div>
  )
}

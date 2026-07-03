// Skeleton loading state for Documents.
// Shown by Next.js App Router Suspense during navigation.
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface-800" />
      <div className="h-4 w-72 rounded bg-surface-800" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 rounded bg-surface-700" />
              <div className="h-5 w-20 rounded-full bg-surface-700" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-4 rounded bg-surface-800" />
              <div className="h-4 rounded bg-surface-800" />
              <div className="h-4 rounded bg-surface-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

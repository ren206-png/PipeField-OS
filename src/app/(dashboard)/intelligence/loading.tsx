// Skeleton loading state for PipeField Intelligence.
export default function IntelligenceLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 p-6 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-surface-800" />
      <div className="h-4 w-80 rounded bg-surface-800" />
      {/* Chat message skeletons */}
      <div className="space-y-4 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
            <div className="w-8 h-8 rounded-full bg-surface-700 flex-shrink-0" />
            <div className={`space-y-2 max-w-sm ${i % 2 === 0 ? '' : 'items-end flex flex-col'}`}>
              <div className="h-4 w-48 rounded bg-surface-700" />
              <div className="h-4 w-64 rounded bg-surface-800" />
              <div className="h-4 w-40 rounded bg-surface-800" />
            </div>
          </div>
        ))}
      </div>
      {/* Input bar skeleton */}
      <div className="h-12 rounded-xl bg-surface-800 mt-6" />
    </div>
  )
}

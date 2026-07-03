// Skeleton loading state for Piping Reference Database.
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded-lg bg-surface-800" />
      <div className="h-4 w-80 rounded bg-surface-800" />
      <div className="card p-6 space-y-4">
        <div className="flex gap-3">
          <div className="h-10 flex-1 rounded-lg bg-surface-700" />
          <div className="h-10 w-28 rounded-lg bg-surface-700" />
          <div className="h-10 w-28 rounded-lg bg-surface-700" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-surface-800">
            <div className="h-4 w-16 rounded bg-surface-700" />
            <div className="h-4 w-20 rounded bg-surface-800" />
            <div className="h-4 w-20 rounded bg-surface-800" />
            <div className="h-4 w-20 rounded bg-surface-800" />
            <div className="h-4 w-20 rounded bg-surface-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

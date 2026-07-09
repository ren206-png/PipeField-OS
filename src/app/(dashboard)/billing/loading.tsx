// Skeleton loading state for Billing page.
export default function BillingLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-surface-800" />
      <div className="h-4 w-64 rounded bg-surface-800" />
      {/* Plan card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-surface-700" />
            <div className="h-4 w-48 rounded bg-surface-800" />
          </div>
          <div className="h-8 w-24 rounded-full bg-surface-700" />
        </div>
        <div className="grid grid-cols-3 gap-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-800" />
          ))}
        </div>
      </div>
      {/* Invoice list */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center justify-between">
            <div className="h-4 w-40 rounded bg-surface-700" />
            <div className="h-4 w-20 rounded bg-surface-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

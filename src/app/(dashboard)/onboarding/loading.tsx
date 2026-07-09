// Skeleton loading state for Onboarding page.
export default function OnboardingLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface-800" />
      <div className="h-4 w-72 rounded bg-surface-800" />
      {/* Step cards */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-700 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-surface-700" />
              <div className="h-3 w-64 rounded bg-surface-800" />
            </div>
            <div className="h-6 w-16 rounded-full bg-surface-700" />
          </div>
        ))}
      </div>
    </div>
  )
}

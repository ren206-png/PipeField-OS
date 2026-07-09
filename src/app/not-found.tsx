// ============================================================
// Root 404 — shown when no route matches.
// Styled to match PipeField OS design system.
// ============================================================
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-900 p-8 text-center">
      {/* Logo mark */}
      <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center shadow-glow mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>

      <p className="text-6xl font-black text-brand-500 mb-2">404</p>
      <h1 className="text-2xl font-semibold text-surface-100 mb-2">Page not found</h1>
      <p className="text-sm text-surface-500 mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-200 text-sm font-medium transition-colors border border-surface-700"
        >
          View Projects
        </Link>
      </div>
    </div>
  )
}

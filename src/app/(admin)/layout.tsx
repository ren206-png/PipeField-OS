'use client'
// ============================================================
// (admin) route group layout — CLIENT COMPONENT
// Uses the existing AuthProvider session (same as the rest of
// the app) so no extra server-side cookie check is needed.
// Non-admins see a 403 screen; unauthenticated users are
// redirected to /login.
// ============================================================
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoading, isAuthenticated, isPlatformAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login?redirect=/admin/overview')
    }
  }, [isLoading, isAuthenticated, router])

  // Still loading — show a minimal spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not authenticated — redirect is firing via useEffect above
  if (!isAuthenticated) return null

  // Wrong role
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold text-surface-50">Access Denied</h1>
          <p className="text-sm text-surface-400">
            This area is restricted to PipeField OS platform administrators only.
          </p>
          <a
            href="/dashboard"
            className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Admin-specific top bar */}
      <header className="border-b border-red-500/20 bg-red-500/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded uppercase tracking-wider">
            Platform Admin
          </span>
          <nav className="flex items-center gap-1">
            <a
              href="/admin/overview"
              className="px-3 py-1.5 text-xs font-medium text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg transition-colors"
            >
              Overview
            </a>
            <a
              href="/admin/users"
              className="px-3 py-1.5 text-xs font-medium text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg transition-colors"
            >
              Users
            </a>
          </nav>
        </div>
        <a href="/dashboard" className="text-xs text-surface-500 hover:text-surface-300 transition-colors">
          ← Back to App
        </a>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}

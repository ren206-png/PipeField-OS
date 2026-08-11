// ============================================================
// (admin) route group layout — SERVER COMPONENT
//
// Server-side auth guard runs before any children render.
// Unauthenticated requests → redirect to /login.
// Authenticated non-platform-admins → redirect to /dashboard.
//
// The API routes under /api/admin/* have their own
// requirePlatformAdmin() guards as defense-in-depth.
// ============================================================
import { redirect } from 'next/navigation'
import { getCallerProfile } from '@/lib/api-auth'
import { ShieldCheck } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const caller = await getCallerProfile()

  // Not authenticated → send to login
  if (!caller) {
    redirect('/login?redirect=/admin/overview')
  }

  // Authenticated but wrong role → send to dashboard
  if (caller.role !== 'platform_admin') {
    redirect('/dashboard')
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
            <a
              href="/admin/system"
              className="px-3 py-1.5 text-xs font-medium text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              System Health
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

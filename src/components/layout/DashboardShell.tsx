// ============================================================
// DashboardShell — The master wrapper for all dashboard pages.
// Combines: Sidebar (desktop) + Header + main content + MobileNav.
// Every page inside (dashboard) uses this shell.
// ============================================================
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

interface DashboardShellProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  headerActions?: React.ReactNode
}

export function DashboardShell({
  children,
  title,
  subtitle,
  headerActions,
}: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header bar */}
        <Header title={title} subtitle={subtitle} actions={headerActions} />

        {/* Scrollable page content */}
        <main
          className="flex-1 overflow-y-auto"
          // Bottom padding accounts for the mobile navigation bar (56px)
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
            <ErrorBoundary label="DashboardPage">
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />

      {/* Floating feedback widget */}
      <FeedbackWidget />
    </div>
  )
}

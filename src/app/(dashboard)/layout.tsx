// ============================================================
// Dashboard Group Layout
// All pages inside (dashboard) inherit this layout.
// Renders the sidebar + header shell around every page.
// Auth protection is handled by src/middleware.ts.
// ============================================================
import type { Metadata } from 'next'
import { DashboardShell } from '@/components/layout/DashboardShell'

export const metadata: Metadata = {
  title: {
    template: '%s | PipeField OS',
    default: 'Dashboard',
  },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}

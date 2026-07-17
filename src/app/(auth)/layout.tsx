// ============================================================
// Auth Layout — wraps Login and Register pages.
// Creates the two-column industrial login screen.
// Left: branding panel. Right: form panel.
// ============================================================
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site-url'

// Individual auth pages are 'use client' and cannot export their own
// metadata, so the layout covers all three routes with a generic title.
// The root template turns this into "Account | PipeField OS".
// canonical points to /login as the primary auth entry point.
export const metadata: Metadata = {
  title: 'Account',
  description: 'Sign in to PipeField OS — pipeline QC and field tools for pipefitters.',
  alternates: {
    canonical: `${SITE_URL}/login`,
  },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left branding panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 bg-surface-950 relative flex-col justify-between p-12 overflow-hidden">
        {/* Industrial grid background */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249,115,22,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249,115,22,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Diagonal accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Logo */}
        <div className="relative z-10">
          <img src="/logo.png" alt="PipeField OS" className="h-14 w-auto" />
        </div>

        {/* Center hero content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-surface-50 leading-tight">
              Built for the<br />
              <span className="text-brand-400">field.</span>
            </h1>
            <p className="text-surface-400 text-lg leading-relaxed max-w-sm">
              Weld tracking, spool management, QA/QC documentation, and fabrication — all in one rugged platform.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {[
              { icon: '⚙️', label: 'Real-time spool & weld tracking' },
              { icon: '📋', label: 'Digital QA/QC documentation' },
              { icon: '📐', label: 'Automated take-off calculator' },
              { icon: '📊', label: 'Live project dashboards' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center text-base">
                  {icon}
                </div>
                <span className="text-surface-300 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10">
          <p className="text-surface-600 text-xs">
            © {new Date().getFullYear()} PipeField OS. Built by pipefitters, for pipefitters.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-surface-900">
        {/* Mobile logo — visible only on small screens */}
        <div className="lg:hidden flex items-center justify-center mb-10">
          <img src="/logo.png" alt="PipeField OS" className="h-12 w-auto" />
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}

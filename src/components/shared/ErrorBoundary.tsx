'use client'
// ============================================================
// ErrorBoundary — catches unhandled render errors in the
// component tree below it and shows a recovery UI instead
// of crashing the entire page.
//
// Usage:
//   <ErrorBoundary>
//     <MyPage />
//   </ErrorBoundary>
//
// Or with a custom fallback:
//   <ErrorBoundary fallback={<p>Something went wrong</p>}>
//     <MyPage />
//   </ErrorBoundary>
// ============================================================
import React, { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children:  ReactNode
  fallback?: ReactNode
  /** Optional label shown in the error panel for easier diagnostics */
  label?:    string
}

interface State {
  hasError: boolean
  error:    Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to the console so it's visible in Vercel function logs.
    console.error(`[ErrorBoundary${this.props.label ? ` / ${this.props.label}` : ''}]`, error, info.componentStack)

    // Report to /api/errors (fire-and-forget)
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          component: this.props.label ?? info.componentStack?.split('\n')[1]?.trim() ?? undefined,
          severity: 'error',
        }),
      }).catch(() => {
        // Silently swallow — never let error reporting crash the app
      })
    } catch {
      // Ignore
    }
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] p-8 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
        <h2 className="text-base font-semibold text-surface-100 mb-1">
          Something went wrong
        </h2>
        <p className="text-sm text-surface-500 mb-4 max-w-sm">
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-sm text-surface-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-sm text-surface-200 transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

// ── Convenience wrappers ──────────────────────────────────────

/** Wraps a page-level section with a labelled error boundary */
export function PageErrorBoundary({
  children,
  label,
}: {
  children: ReactNode
  label?:   string
}) {
  return <ErrorBoundary label={label}>{children}</ErrorBoundary>
}

/**
 * Compact inline fallback for sidebar items or small widgets.
 * Shows a subtle error chip instead of a full card so the rest of the UI stays intact.
 */
export function WidgetErrorBoundary({
  children,
  label,
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <ErrorBoundary
      label={label}
      fallback={
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{label ?? 'Widget'} failed to load</span>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Higher-order component that wraps a component with ErrorBoundary.
 *
 * @example
 * const SafeChart = withErrorBoundary(Chart, { label: 'Chart' })
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  boundaryProps?: Omit<Props, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName ?? WrappedComponent.name ?? 'Component'

  function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...boundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`
  return WithErrorBoundary
}

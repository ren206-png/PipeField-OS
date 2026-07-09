'use client'
import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback'

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <DashboardErrorFallback error={error} reset={reset} label="Reports" />
}

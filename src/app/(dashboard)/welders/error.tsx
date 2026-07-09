'use client'
import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback'

export default function WeldersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <DashboardErrorFallback error={error} reset={reset} label="Welders" />
}

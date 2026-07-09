'use client'
import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback'

export default function CalculatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <DashboardErrorFallback error={error} reset={reset} label="Calculator" />
}

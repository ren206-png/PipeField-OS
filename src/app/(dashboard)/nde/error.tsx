'use client'
import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback'

export default function NdeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <DashboardErrorFallback error={error} reset={reset} label="NDE Engine" />
}

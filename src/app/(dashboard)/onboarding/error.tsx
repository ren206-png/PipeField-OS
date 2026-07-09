'use client'
import { DashboardErrorFallback } from '@/components/shared/DashboardErrorFallback'

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <DashboardErrorFallback error={error} reset={reset} label="Onboarding" />
}

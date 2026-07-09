// ============================================================
// usePlanLimits — plan, usage, and limit helpers.
//
// Previously used useEffect + raw fetch with no caching.
// Now a thin wrapper over useUsage so all callers share the
// same React Query cache entry (staleTime: 5 min) and never
// fire duplicate /api/billing/usage requests on navigation.
// ============================================================
'use client'

import { useUsage } from './useUsage'
import type { PlanKey } from '@/lib/plans'

export interface PlanUsage {
  projects: number
  users:    number
  welds:    number
}

export interface PlanLimits {
  projects: number | null   // null = unlimited
  users:    number | null
  welds:    number | null
}

export interface UsePlanLimitsResult {
  plan:       PlanKey | null
  limits:     PlanLimits | null
  usage:      PlanUsage | null
  isLoading:  boolean
  error:      string | null
  /** True when the org has reached or exceeded the limit for a resource. */
  isAtLimit:  (resource: keyof PlanUsage) => boolean
  /** True when the org can still create more of a resource. */
  canCreate:  (resource: keyof PlanUsage) => boolean
}

export function usePlanLimits(): UsePlanLimitsResult {
  const { data, isLoading, error } = useUsage()

  function isAtLimit(resource: keyof PlanUsage): boolean {
    if (!data) return false
    const limit = data.limits[resource]
    if (limit === null) return false   // unlimited
    return data.usage[resource] >= limit
  }

  function canCreate(resource: keyof PlanUsage): boolean {
    return !isAtLimit(resource)
  }

  return {
    plan:      data?.plan      ?? null,
    limits:    data?.limits    ?? null,
    usage:     data?.usage     ?? null,
    isLoading,
    error:     error ? (error instanceof Error ? error.message : 'Failed to load plan') : null,
    isAtLimit,
    canCreate,
  }
}

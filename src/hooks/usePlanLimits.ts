// ============================================================
// usePlanLimits — fetches current org plan, usage, and limits.
// Returns helpers to check whether the org can create more of
// a given resource (projects, users, welds).
// ============================================================
'use client'

import { useEffect, useState } from 'react'
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
  const [plan,      setPlan]      = useState<PlanKey | null>(null)
  const [limits,    setLimits]    = useState<PlanLimits | null>(null)
  const [usage,     setUsage]     = useState<PlanUsage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/billing/usage')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as {
          plan:   PlanKey
          usage:  PlanUsage
          limits: PlanLimits
        }
        if (cancelled) return
        setPlan(json.plan)
        setUsage(json.usage)
        setLimits(json.limits)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load plan')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  function isAtLimit(resource: keyof PlanUsage): boolean {
    if (!usage || !limits) return false
    const limit = limits[resource]
    if (limit === null) return false   // unlimited
    return usage[resource] >= limit
  }

  function canCreate(resource: keyof PlanUsage): boolean {
    return !isAtLimit(resource)
  }

  return { plan, limits, usage, isLoading, error, isAtLimit, canCreate }
}

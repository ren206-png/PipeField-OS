'use client'
// ============================================================
// useUsage — fetches current org billing usage from the API.
// Wraps /api/billing/usage with React Query for caching.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import type { PlanKey } from '@/lib/plans'
import { apiFetch } from '@/lib/apiFetch'

export interface UsageData {
  plan: PlanKey
  usage: {
    projects: number
    users:    number
    welds:    number
  }
  limits: {
    projects: number | null   // null = unlimited
    users:    number | null
    welds:    number | null
  }
}

export function useUsage() {
  return useQuery<UsageData>({
    queryKey: ['billing-usage'],
    queryFn:  () => apiFetch('/api/billing/usage').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<UsageData>
    }),
    staleTime: 1000 * 60 * 5,  // 5 min
  })
}

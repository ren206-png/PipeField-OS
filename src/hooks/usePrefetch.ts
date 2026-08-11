'use client'
// ============================================================
// usePrefetch — hover-triggered prefetch helpers.
//
// Calling usePrefetchWeld() / usePrefetchSpool() returns a
// function you can attach to onMouseEnter on any list card.
// When the user hovers a row, the detail data is fetched
// into the React Query cache so the detail page loads
// instantly when they click.
//
// Uses the same queryKey as useWeld / useSpool so the cache
// entry is shared — no duplicate requests.
// ============================================================
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { fetchWeld } from './useWelds'
import { fetchSpool } from './useSpools'

const STALE_TIME = 30 * 1000 // match the hook staleTime

/** Returns a prefetch function for weld detail.
 *  No-ops if the caller has no organization_id (prevents unscoped queries). */
export function usePrefetchWeld() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const organizationId = profile?.organization_id ?? null

  return (id: string) => {
    if (!organizationId) return // guard: never prefetch without a real org scope
    // prefetchQuery is a no-op if data is already fresh in cache
    void queryClient.prefetchQuery({
      queryKey: ['weld', id, organizationId],
      queryFn: () => fetchWeld(id, organizationId),
      staleTime: STALE_TIME,
    })
  }
}

/** Returns a prefetch function for spool detail.
 *  No-ops if the caller has no organization_id (prevents unscoped queries). */
export function usePrefetchSpool() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const organizationId = profile?.organization_id ?? null

  return (id: string) => {
    if (!organizationId) return // guard: never prefetch without a real org scope
    void queryClient.prefetchQuery({
      queryKey: ['spool', id, organizationId],
      queryFn: () => fetchSpool(id, organizationId),
      staleTime: STALE_TIME,
    })
  }
}

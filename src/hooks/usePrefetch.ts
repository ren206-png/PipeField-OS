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
import { fetchWeld } from './useWelds'
import { fetchSpool } from './useSpools'

const STALE_TIME = 30 * 1000 // match the hook staleTime

/** Returns a prefetch function for weld detail. */
export function usePrefetchWeld() {
  const queryClient = useQueryClient()

  return (id: string) => {
    // prefetchQuery is a no-op if data is already fresh in cache
    void queryClient.prefetchQuery({
      queryKey: ['weld', id],
      queryFn: () => fetchWeld(id),
      staleTime: STALE_TIME,
    })
  }
}

/** Returns a prefetch function for spool detail. */
export function usePrefetchSpool() {
  const queryClient = useQueryClient()

  return (id: string) => {
    void queryClient.prefetchQuery({
      queryKey: ['spool', id],
      queryFn: () => fetchSpool(id),
      staleTime: STALE_TIME,
    })
  }
}

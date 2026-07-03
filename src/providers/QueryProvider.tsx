// ============================================================
// TanStack Query Provider
// Wraps the entire app so any component can fetch and cache
// server data using the useQuery / useMutation hooks.
//
// Global mutation error handler: any mutation that throws and
// is not caught by the calling component's own onError will
// surface here as a toast — ensures no error is ever silently
// swallowed, regardless of whether the caller uses mutate()
// or mutateAsync().
// ============================================================
'use client'

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { toast } from 'sonner'
import { useState, type ReactNode } from 'react'

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'An unexpected error occurred.'
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create one QueryClient per browser session.
  // MutationCache.onError fires for every failed mutation — acts as a
  // global safety net for errors not handled at the call site.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (err, query) => {
            // Only show a toast for background refetches (data already in cache).
            // Initial loads show their own error UI via isError state.
            if (query.state.data !== undefined) {
              toast.error(`Refresh failed: ${formatError(err)}`)
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (err) => {
            toast.error(formatError(err))
          },
        }),
        defaultOptions: {
          queries: {
            staleTime:           60 * 1000, // fresh for 1 minute
            retry:               1,         // retry failed requests once
            refetchOnWindowFocus: true,     // re-fetch when tab regains focus
          },
          mutations: {
            // Re-throw so callers using mutateAsync + try/catch still work.
            // The MutationCache.onError above fires first (toast), then the
            // caller's catch block fires for any additional handling.
            throwOnError: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

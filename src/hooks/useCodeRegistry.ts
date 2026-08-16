'use client'
// ============================================================
// useCodeRegistry — fetch the global code_registry table.
// Used by ProjectStandardsCard to populate the governing code
// selector. Entries are ordered by standard + edition desc.
// ============================================================
import { useQuery } from '@tanstack/react-query'

export interface CodeRegistryEntry {
  id:       string
  standard: string
  edition:  string
  label:    string
  regions:  string[] | null
}

export function useCodeRegistry(region?: string) {
  return useQuery<CodeRegistryEntry[]>({
    queryKey: ['code-registry', region ?? 'global'],
    staleTime: 5 * 60 * 1000, // 5 min — rarely changes
    queryFn: async () => {
      const url = region
        ? `/api/code-registry?region=${encodeURIComponent(region)}`
        : '/api/code-registry'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch code registry')
      return res.json() as Promise<CodeRegistryEntry[]>
    },
  })
}

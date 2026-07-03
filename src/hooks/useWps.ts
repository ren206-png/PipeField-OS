'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface WpsRecord {
  id:                   string
  organization_id:      string
  wps_number:           string
  revision:             string
  process:              string
  base_metal_p_numbers: string | null
  filler_material:      string | null
  thickness_min_in:     number | null
  thickness_max_in:     number | null
  position:             string | null
  pwht_required:        boolean
  notes:                string | null
  is_active:            boolean
  created_at:           string
  updated_at:           string
}

type WpsInput = Omit<WpsRecord, 'id' | 'organization_id' | 'created_at' | 'updated_at'>

export function useWpsList() {
  return useQuery<WpsRecord[]>({
    queryKey: ['wps'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch('/api/wps')
      if (!res.ok) throw new Error('Failed to load WPS records')
      return res.json()
    },
  })
}

export function useCreateWps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: WpsInput) => {
      const res = await fetch('/api/wps', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      return res.json() as Promise<WpsRecord>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wps'] }),
  })
}

export function useUpdateWps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<WpsRecord> & { id: string }) => {
      const res = await fetch(`/api/wps/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      return res.json() as Promise<WpsRecord>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wps'] }),
  })
}

export function useDeleteWps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wps/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wps'] }),
  })
}

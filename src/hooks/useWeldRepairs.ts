'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'

export interface WeldRepair {
  id:                   string
  organization_id:      string
  weld_id:              string
  repair_number:        number
  failure_mode:         string | null
  repair_method:        string | null
  authorized_by:        string | null
  repair_welder_stamp:  string | null
  repair_welder_name:   string | null
  repair_date:          string | null
  re_inspection_type:   string | null
  re_inspection_result: 'pass' | 'fail' | 'pending' | null
  re_inspection_date:   string | null
  notes:                string | null
  created_by:           string | null
  created_at:           string
  updated_at:           string
}

export type CreateWeldRepairInput = Omit<WeldRepair, 'id' | 'organization_id' | 'weld_id' | 'created_by' | 'created_at' | 'updated_at'>
export type UpdateWeldRepairInput = Partial<CreateWeldRepairInput>

export function useWeldRepairs(weldId: string) {
  return useQuery<WeldRepair[]>({
    queryKey: ['weld-repairs', weldId],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiFetch(`/api/welds/${weldId}/repairs`)
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    enabled: !!weldId,
  })
}

export function useCreateWeldRepair(weldId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateWeldRepairInput) => {
      const res = await apiFetch(`/api/welds/${weldId}/repairs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<WeldRepair>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weld-repairs', weldId] })
    },
  })
}

export function useUpdateWeldRepair(weldId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ repairId, ...input }: UpdateWeldRepairInput & { repairId: string }) => {
      const res = await apiFetch(`/api/welds/${weldId}/repairs/${repairId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<WeldRepair>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weld-repairs', weldId] })
    },
  })
}

export function useDeleteWeldRepair(weldId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (repairId: string) => {
      const res = await apiFetch(`/api/welds/${weldId}/repairs/${repairId}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) throw new Error(await res.text())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weld-repairs', weldId] })
    },
  })
}

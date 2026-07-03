'use client'
// ============================================================
// usePipeSupport — TanStack Query hooks for saving, listing,
// and updating Pipe Support calculations in Supabase.
// Pattern mirrors useWelds.ts.
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

// ── Types ─────────────────────────────────────────────────────

export interface PipeSupportCalc {
  id: string
  organization_id: string
  project_id: string | null
  name: string
  inputs: Record<string, unknown>
  result: Record<string, unknown>
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SavePipeSupportPayload {
  project_id: string | null
  name: string
  inputs: Record<string, unknown>
  result: Record<string, unknown>
  notes?: string
}

// ── Query key factory ─────────────────────────────────────────

const qk = {
  list:   (orgId: string, projectId?: string) => ['pipe-support-calcs', orgId, projectId ?? 'all'] as const,
  detail: (id: string)                         => ['pipe-support-calc', id] as const,
}

// ── List hook ─────────────────────────────────────────────────

export function usePipeSupportCalcs(projectId?: string) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: qk.list(profile?.organization_id ?? '', projectId),
    staleTime: 60_000,
    queryFn: async (): Promise<PipeSupportCalc[]> => {
      if (!profile?.organization_id) return []
      const supabase = createClient()
      let q = supabase
        .from('pipe_support_calculations')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PipeSupportCalc[]
    },
    enabled: !!profile?.organization_id,
  })
}

// ── Save (create) mutation ─────────────────────────────────────

export function useSavePipeSupportCalc() {
  const { profile } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SavePipeSupportPayload): Promise<PipeSupportCalc> => {
      if (!profile?.organization_id) throw new Error('Not authenticated')
      const supabase = createClient()

      const { data, error } = await supabase
        .from('pipe_support_calculations')
        .insert({
          organization_id: profile.organization_id,
          project_id:      payload.project_id,
          name:            payload.name,
          inputs:          payload.inputs,
          result:          payload.result,
          notes:           payload.notes ?? null,
          created_by:      profile.id,
        })
        .select()
        .single()

      if (error) throw error

      // Audit trail
      await supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        table_name:      'pipe_support_calculations',
        record_id:       data.id,
        action:          'INSERT',
        performed_by:    profile.id,
        new_values:      { name: data.name, project_id: data.project_id },
      })

      return data as PipeSupportCalc
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pipe-support-calcs', profile?.organization_id ?? ''] })
      qc.setQueryData(qk.detail(data.id), data)
    },
  })
}

// ── Update mutation ────────────────────────────────────────────

export function useUpdatePipeSupportCalc() {
  const { profile } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SavePipeSupportPayload> & { id: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('pipe_support_calculations')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      await supabase.from('audit_logs').insert({
        organization_id: profile?.organization_id,
        table_name:      'pipe_support_calculations',
        record_id:       id,
        action:          'UPDATE',
        performed_by:    profile?.id,
        new_values:      patch,
      })

      return data as PipeSupportCalc
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pipe-support-calcs', profile?.organization_id ?? ''] })
      qc.setQueryData(qk.detail(data.id), data)
    },
  })
}

// ── Delete mutation ────────────────────────────────────────────

export function useDeletePipeSupportCalc() {
  const { profile } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('pipe_support_calculations')
        .delete()
        .eq('id', id)
      if (error) throw error

      await supabase.from('audit_logs').insert({
        organization_id: profile?.organization_id,
        table_name:      'pipe_support_calculations',
        record_id:       id,
        action:          'DELETE',
        performed_by:    profile?.id,
        new_values:      {},
      })
    },
    onSuccess: (_v, id) => {
      qc.invalidateQueries({ queryKey: ['pipe-support-calcs', profile?.organization_id ?? ''] })
      qc.removeQueries({ queryKey: qk.detail(id) })
    },
  })
}

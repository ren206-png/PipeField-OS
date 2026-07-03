'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { NdeInspection, NdeResult } from '@/types'

export function useNdeInspections(weldId: string) {
  const { profile } = useAuth()
  const supabase    = createClient()

  return useQuery({
    queryKey: ['nde', weldId],
    staleTime: 30_000,
    queryFn: async (): Promise<NdeInspection[]> => {
      if (!profile?.organization_id) return []
      const { data, error } = await supabase
        .from('nde_inspections')
        .select('*')
        .eq('weld_id', weldId)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as NdeInspection[]
    },
    enabled: !!profile?.organization_id && !!weldId,
  })
}

export function useProjectNde(projectId: string) {
  const { profile } = useAuth()
  const supabase    = createClient()

  return useQuery({
    queryKey: ['nde', 'project', projectId],
    staleTime: 30_000,
    queryFn: async (): Promise<NdeInspection[]> => {
      if (!profile?.organization_id) return []
      const { data, error } = await supabase
        .from('nde_inspections')
        .select('*, welds(weld_id_number)')
        .eq('project_id', projectId)
        .eq('organization_id', profile.organization_id)
        .order('inspection_date', { ascending: false })
      if (error) throw error
      return (data ?? []) as NdeInspection[]
    },
    enabled: !!profile?.organization_id && !!projectId,
  })
}

export function useCreateNdeInspection() {
  const { profile } = useAuth()
  const supabase    = createClient()
  const qc          = useQueryClient()

  return useMutation({
    mutationFn: async (values: Omit<NdeInspection, 'id' | 'organization_id' | 'created_by' | 'created_at' | 'updated_at'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('nde_inspections')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['nde', vars.weld_id] })
      qc.invalidateQueries({ queryKey: ['nde', 'project', vars.project_id] })
    },
  })
}

export function useUpdateNdeResult() {
  const supabase = createClient()
  const qc       = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, result, notes }: { id: string; result: NdeResult; notes?: string }) => {
      const { data, error } = await supabase
        .from('nde_inspections')
        .update({ result, notes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as NdeInspection
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['nde', data.weld_id] })
      qc.invalidateQueries({ queryKey: ['nde', 'project', data.project_id] })
    },
  })
}

export function useDeleteNdeInspection() {
  const supabase = createClient()
  const qc       = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, weldId, projectId }: { id: string; weldId: string; projectId: string }) => {
      const { error } = await supabase.from('nde_inspections').delete().eq('id', id)
      if (error) throw error
      return { weldId, projectId }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['nde', vars.weldId] })
      qc.invalidateQueries({ queryKey: ['nde', 'project', vars.projectId] })
    },
  })
}

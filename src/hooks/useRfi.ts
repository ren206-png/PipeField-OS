'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Rfi } from '@/types'

export function useRfis(projectId?: string) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['rfi', projectId ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<Rfi[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('rfis')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Rfi[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useRfi(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['rfi', 'detail', id],
    staleTime: 30_000,
    queryFn: async (): Promise<Rfi | null> => {
      const { data, error } = await supabase
        .from('rfis')
        .select('*, project:projects(name, project_number)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as Rfi | null
    },
    enabled: !!id,
  })
}

export function useCreateRfi() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Rfi, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('rfis')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select()
        .single()
      if (error) throw error
      return data as Rfi
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rfi'] })
    },
  })
}

export function useUpdateRfi() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Rfi> & { id: string }) => {
      const { data, error } = await supabase
        .from('rfis')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Rfi
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['rfi'] })
      qc.invalidateQueries({ queryKey: ['rfi', 'detail', data.id] })
    },
  })
}

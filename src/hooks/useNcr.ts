'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Ncr } from '@/types'

export function useNcrs(projectId?: string) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['ncr', projectId ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<Ncr[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('ncrs')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Ncr[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useNcr(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['ncr', 'detail', id],
    staleTime: 30_000,
    queryFn: async (): Promise<Ncr | null> => {
      const { data, error } = await supabase
        .from('ncrs').select('*, project:projects(name, project_number)')
        .eq('id', id).maybeSingle()
      if (error) throw error
      return data as Ncr | null
    },
    enabled: !!id,
  })
}

export function useCreateNcr() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Ncr, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'|'closed_by'|'closed_at'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('ncrs')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select().single()
      if (error) throw error
      return data as Ncr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ncr'] })
    },
  })
}

export function useUpdateNcr() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Ncr> & { id: string }) => {
      const { data, error } = await supabase
        .from('ncrs')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return data as Ncr
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ncr'] })
      qc.invalidateQueries({ queryKey: ['ncr', 'detail', data.id] })
    },
  })
}

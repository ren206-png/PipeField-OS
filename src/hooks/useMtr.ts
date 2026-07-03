'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Mtr, MtrStatus } from '@/types'

export function useMtrs(projectId?: string, status?: MtrStatus) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['mtr', projectId ?? 'all', status ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<Mtr[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('mtrs')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('received_date', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      if (status)    q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Mtr[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useMtr(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['mtr', 'detail', id],
    staleTime: 30_000,
    queryFn: async (): Promise<Mtr | null> => {
      const { data, error } = await supabase
        .from('mtrs').select('*, project:projects(name, project_number)')
        .eq('id', id).maybeSingle()
      if (error) throw error
      return data as Mtr | null
    },
    enabled: !!id,
  })
}

export function useCreateMtr() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Mtr, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('mtrs')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select().single()
      if (error) throw error
      return data as Mtr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mtr'] })
    },
  })
}

export function useUpdateMtr() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Mtr> & { id: string }) => {
      const { data, error } = await supabase
        .from('mtrs').update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return data as Mtr
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mtr'] })
      qc.invalidateQueries({ queryKey: ['mtr', 'detail', data.id] })
    },
  })
}

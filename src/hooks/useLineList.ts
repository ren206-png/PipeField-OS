'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { PipeLine, LineStatus, LinePriority } from '@/types'

export function useLines(projectId?: string) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['lines', projectId ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<PipeLine[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('line_list')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('line_number', { ascending: true })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PipeLine[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useLine(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['lines', 'detail', id],
    staleTime: 30_000,
    queryFn: async (): Promise<PipeLine | null> => {
      const { data, error } = await supabase
        .from('line_list')
        .select('*, project:projects(name, project_number)')
        .eq('id', id).maybeSingle()
      if (error) throw error
      return data as PipeLine | null
    },
    enabled: !!id,
  })
}

export function useCreateLine() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<PipeLine, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('line_list')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select().single()
      if (error) throw error
      return data as PipeLine
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lines'] })
    },
  })
}

export function useUpdateLine() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<PipeLine> & { id: string }) => {
      const { data, error } = await supabase
        .from('line_list')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return data as PipeLine
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['lines'] })
      qc.invalidateQueries({ queryKey: ['lines', 'detail', data.id] })
    },
  })
}

export function useDeleteLine() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('line_list').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lines'] })
    },
  })
}

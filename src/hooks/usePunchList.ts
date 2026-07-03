'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { PunchItem, PunchStatus } from '@/types'

export function usePunchItems(projectId?: string, status?: PunchStatus) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['punch', projectId ?? 'all', status ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<PunchItem[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('punch_items')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('item_number', { ascending: true })
      if (projectId) q = q.eq('project_id', projectId)
      if (status)    q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PunchItem[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useCreatePunchItem() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<PunchItem, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'|'closed_by'|'closed_at'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('punch_items')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select()
        .single()
      if (error) throw error
      return data as PunchItem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['punch'] })
    },
  })
}

export function useUpdatePunchItem() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<PunchItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('punch_items')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PunchItem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['punch'] })
    },
  })
}

export function useClosePunchItem() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, resolution_notes }: { id: string; resolution_notes?: string }) => {
      const { data, error } = await supabase
        .from('punch_items')
        .update({
          status: 'closed',
          closed_by: profile?.id,
          closed_at: new Date().toISOString(),
          resolution_notes: resolution_notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PunchItem
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['punch'] })
    },
  })
}

export function useDeletePunchItem() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('punch_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['punch'] })
    },
  })
}

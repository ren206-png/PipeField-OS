'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Itp, ItpItem } from '@/types'

export function useItps(projectId?: string) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['itp', projectId ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<Itp[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('itps')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Itp[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useItp(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['itp', 'detail', id],
    staleTime: 30_000,
    queryFn: async (): Promise<Itp | null> => {
      const { data, error } = await supabase
        .from('itps')
        .select('*, project:projects(name, project_number), itp_items(*)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const itp = data as Itp
      if (itp.itp_items) {
        itp.itp_items = (itp.itp_items as ItpItem[]).sort((a, b) => a.sort_order - b.sort_order)
      }
      return itp
    },
    enabled: !!id,
  })
}

export function useCreateItp() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<Itp, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'|'itp_items'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('itps')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select().single()
      if (error) throw error
      return data as Itp
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['itp'] })
    },
  })
}

export function useUpdateItp() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Itp> & { id: string }) => {
      const { data, error } = await supabase
        .from('itps').update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return data as Itp
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['itp'] })
      qc.invalidateQueries({ queryKey: ['itp', 'detail', data.id] })
    },
  })
}

export function useCreateItpItem() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<ItpItem, 'id'|'organization_id'|'created_at'|'updated_at'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('itp_items')
        .insert({ ...values, organization_id: profile.organization_id })
        .select().single()
      if (error) throw error
      return data as ItpItem
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['itp', 'detail', data.itp_id] })
    },
  })
}

export function useUpdateItpItem() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, itp_id, ...values }: Partial<ItpItem> & { id: string; itp_id: string }) => {
      const { data, error } = await supabase
        .from('itp_items').update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return { ...data, itp_id } as ItpItem
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['itp', 'detail', data.itp_id] })
    },
  })
}

export function useDeleteItpItem() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, itpId }: { id: string; itpId: string }) => {
      const { error } = await supabase.from('itp_items').delete().eq('id', id)
      if (error) throw error
      return itpId
    },
    onSuccess: (itpId) => {
      qc.invalidateQueries({ queryKey: ['itp', 'detail', itpId] })
    },
  })
}

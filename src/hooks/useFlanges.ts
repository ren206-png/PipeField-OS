'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { FlangeJoint } from '@/types'

export function useFlangeJoints(projectId?: string) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['flanges', projectId ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<FlangeJoint[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('flange_joints')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('joint_number', { ascending: true })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as FlangeJoint[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useFlangeJoint(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['flanges', 'detail', id],
    staleTime: 30_000,
    queryFn: async (): Promise<FlangeJoint | null> => {
      const { data, error } = await supabase
        .from('flange_joints')
        .select('*, project:projects(name, project_number)')
        .eq('id', id).maybeSingle()
      if (error) throw error
      return data as FlangeJoint | null
    },
    enabled: !!id,
  })
}

export function useCreateFlangeJoint() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<FlangeJoint, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('flange_joints')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select().single()
      if (error) throw error
      return data as FlangeJoint
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flanges'] })
    },
  })
}

export function useUpdateFlangeJoint() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<FlangeJoint> & { id: string }) => {
      const { data, error } = await supabase
        .from('flange_joints')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return data as FlangeJoint
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['flanges'] })
      qc.invalidateQueries({ queryKey: ['flanges', 'detail', data.id] })
    },
  })
}

'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { PressureTest } from '@/types'

export function usePressureTests(projectId?: string) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['pressure-tests', projectId ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<PressureTest[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('pressure_tests')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('test_date', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PressureTest[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function usePressureTest(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['pressure-tests', 'detail', id],
    staleTime: 30_000,
    queryFn: async (): Promise<PressureTest | null> => {
      const { data, error } = await supabase
        .from('pressure_tests')
        .select('*, project:projects(name, project_number)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as PressureTest | null
    },
    enabled: !!id,
  })
}

export function useCreatePressureTest() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<PressureTest, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'|'approved_by'|'approved_at'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('pressure_tests')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select().single()
      if (error) throw error
      return data as PressureTest
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pressure-tests'] })
    },
  })
}

export function useUpdatePressureTest() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<PressureTest> & { id: string }) => {
      const { data, error } = await supabase
        .from('pressure_tests')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select().single()
      if (error) throw error
      return data as PressureTest
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['pressure-tests'] })
      qc.invalidateQueries({ queryKey: ['pressure-tests', 'detail', data.id] })
    },
  })
}

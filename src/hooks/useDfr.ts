'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { DailyFieldReport, DfrStatus } from '@/types'

export function useDfrs(projectId?: string) {
  const { profile } = useAuth()
  const supabase = createClient()
  return useQuery({
    queryKey: ['dfr', projectId ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<DailyFieldReport[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('daily_field_reports')
        .select('*, project:projects(name, project_number)')
        .eq('organization_id', profile.organization_id)
        .order('report_date', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as DailyFieldReport[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useDfr(id: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['dfr', 'detail', id],
    staleTime: 30_000,
    queryFn: async (): Promise<DailyFieldReport | null> => {
      const { data, error } = await supabase
        .from('daily_field_reports')
        .select('*, project:projects(name, project_number)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as DailyFieldReport | null
    },
    enabled: !!id,
  })
}

export function useCreateDfr() {
  const { profile } = useAuth()
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Omit<DailyFieldReport, 'id'|'organization_id'|'created_by'|'created_at'|'updated_at'|'project'|'approved_by'|'approved_at'>) => {
      if (!profile?.organization_id) throw new Error('No org')
      const { data, error } = await supabase
        .from('daily_field_reports')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select()
        .single()
      if (error) throw error
      return data as DailyFieldReport
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dfr'] })
      // fire-and-forget notification
      fetch('/api/notifications/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: data.id,
          projectId: data.project_id,
          reportDate: data.report_date,
          summaryLine: (data as any).summary ?? 'Daily field report submitted',
        }),
      }).catch(() => {})
    },
  })
}

export function useUpdateDfr() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<DailyFieldReport> & { id: string }) => {
      const { data, error } = await supabase
        .from('daily_field_reports')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as DailyFieldReport
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dfr'] })
      qc.invalidateQueries({ queryKey: ['dfr', 'detail', data.id] })
    },
  })
}

export function useDeleteDfr() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_field_reports').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dfr'] })
    },
  })
}

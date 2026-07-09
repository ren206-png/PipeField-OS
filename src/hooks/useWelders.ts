'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/apiFetch'
import { useAuth } from './useAuth'
import type { Welder } from '@/types'

export function useWelders(activeOnly = false) {
  const { profile } = useAuth()
  const supabase    = createClient()

  return useQuery({
    queryKey: ['welders', profile?.organization_id, activeOnly],
    staleTime: 5 * 60 * 1000, // welder registry rarely changes — 5 min
    queryFn: async (): Promise<Welder[]> => {
      if (!profile?.organization_id) return []
      let q = supabase
        .from('welders')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('full_name')
      if (activeOnly) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Welder[]
    },
    enabled: !!profile?.organization_id,
  })
}

export function useWelder(id: string) {
  const { profile } = useAuth()
  const supabase    = createClient()

  return useQuery({
    queryKey: ['welder', id],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Welder | null> => {
      if (!profile?.organization_id) return null
      const { data, error } = await supabase
        .from('welders')
        .select('*')
        .eq('id', id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle()
      if (error) throw error
      return data as Welder | null
    },
    enabled: !!profile?.organization_id && !!id,
  })
}

export function useCreateWelder() {
  const qc = useQueryClient()

  // P0-FIX-2: creation routes through /api/welders so the server-side
  // plan-seat limit (checkWelderLimit) is enforced before any DB write.
  return useMutation({
    mutationFn: async (values: Omit<Welder, 'id' | 'organization_id' | 'created_by' | 'created_at' | 'updated_at'>) => {
      const res = await apiFetch('/api/welders', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error ?? 'Failed to create welder')
      }
      const json = await res.json() as { welder: Welder }
      return json.welder
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['welders'] }),
  })
}

export function useUpdateWelder() {
  const supabase = createClient()
  const qc       = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Welder> & { id: string }) => {
      const { data, error } = await supabase
        .from('welders')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['welders'] })
      qc.invalidateQueries({ queryKey: ['welder', vars.id] })
    },
  })
}

export function useDeleteWelder() {
  const supabase = createClient()
  const qc       = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('welders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['welders'] }),
  })
}

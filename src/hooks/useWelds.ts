'use client'
// ============================================================
// useWelds — weld list, detail, and status mutation.
//
// Optimistic update strategy (useUpdateWeldStatus):
//   onMutate  → cancel in-flight queries, snapshot cache,
//               immediately apply new status to UI
//   onError   → roll back to snapshot so UI is consistent
//   onSettled → re-fetch to confirm server state
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { WeldStatus } from '@/types'

// ── Shared query function (also used by usePrefetchWeld) ──────

export async function fetchWeld(id: string) {
  const supabase = createClient()

  // All three queries run in parallel — eliminates 2 sequential round-trips
  const [weldRes, photosRes, auditRes] = await Promise.all([
    supabase
      .from('welds')
      .select('*, projects(name), spools(spool_number)')
      .eq('id', id)
      .single(),
    supabase
      .from('weld_photos')
      .select('*')
      .eq('weld_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('audit_logs')
      .select('*, user_profiles(full_name)')
      .eq('table_name', 'welds')
      .eq('record_id', id)
      .order('performed_at', { ascending: false }),
  ])

  if (weldRes.error) throw weldRes.error
  return { ...weldRes.data, photos: photosRes.data ?? [], timeline: auditRes.data ?? [] }
}

// ── Hooks ─────────────────────────────────────────────────────

export function useWelds(filters: {
  projectId?: string
  status?:    WeldStatus
  search?:    string
  page?:      number
} = {}) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['welds', profile?.organization_id, filters],
    staleTime: 30 * 1000, // welds change frequently in the field — 30 s
    queryFn: async () => {
      if (!profile?.organization_id) return { welds: [] as unknown[], count: 0 }

      const supabase = createClient()
      let query = supabase
        .from('welds')
        .select('*, projects(name), spools(spool_number)', { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })

      if (filters.projectId) query = query.eq('project_id', filters.projectId)
      if (filters.status)    query = query.eq('status', filters.status)
      if (filters.search)    query = query.or(
        `weld_id_number.ilike.%${filters.search}%,welder_name.ilike.%${filters.search}%,welder_stamp.ilike.%${filters.search}%`
      )

      const from = ((filters.page ?? 1) - 1) * 25
      query = query.range(from, from + 24)

      const { data, error, count } = await query
      if (error) throw error
      return { welds: data ?? [], count: count ?? 0 }
    },
    enabled: !!profile?.organization_id,
  })
}

export function useWeld(id: string) {
  return useQuery({
    queryKey: ['weld', id],
    staleTime: 30 * 1000,
    queryFn: () => fetchWeld(id),
    enabled: !!id,
  })
}

export function useWeldsRealtime(organizationId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!organizationId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`welds:org:${organizationId}`)
      .on('postgres_changes', {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'welds',
        filter: `organization_id=eq.${organizationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['welds'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [organizationId, queryClient])
}

export function useUpdateWeldStatus() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({
      weldId, newStatus, notes,
    }: { weldId: string; newStatus: WeldStatus; notes?: string }) => {
      const supabase = createClient()

      const { data: current } = await supabase
        .from('welds')
        .select('status')
        .eq('id', weldId)
        .single()

      const { data, error } = await supabase
        .from('welds')
        .update({ status: newStatus, ...(notes !== undefined && { notes }) })
        .eq('id', weldId)
        .select()
        .single()
      if (error) throw error

      if (profile) {
        await supabase.from('audit_logs').insert({
          organization_id: profile.organization_id,
          table_name:      'welds',
          record_id:       weldId,
          action:          'UPDATE',
          previous_values: { status: (current as { status?: string } | null)?.status },
          new_values:      { status: newStatus, notes },
          performed_by:    profile.id,
        })
      }

      // Fire-and-forget email notification — never blocks the UI
      fetch('/api/notifications/weld-status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          weldId,
          oldStatus: (current as { status?: string } | null)?.status ?? '',
          newStatus,
          notes: notes ?? null,
        }),
      }).catch(() => { /* silent — email failure never surfaces to user */ })

      return data
    },

    // ── Optimistic update ─────────────────────────────────────
    onMutate: async ({ weldId, newStatus, notes }) => {
      await queryClient.cancelQueries({ queryKey: ['weld', weldId] })
      await queryClient.cancelQueries({ queryKey: ['welds'] })

      const previousWeld  = queryClient.getQueryData(['weld', weldId])
      const previousWelds = queryClient.getQueriesData({ queryKey: ['welds'] })

      // Optimistically update detail cache
      queryClient.setQueryData(['weld', weldId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        return { ...(old as object), status: newStatus, ...(notes !== undefined && { notes }) }
      })

      // Optimistically update all matching list caches
      queryClient.setQueriesData({ queryKey: ['welds'] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const data = old as { welds?: Array<Record<string, unknown>>; count?: number }
        if (!data.welds) return old
        return {
          ...data,
          welds: data.welds.map(w =>
            w.id === weldId
              ? { ...w, status: newStatus, ...(notes !== undefined && { notes }) }
              : w
          ),
        }
      })

      return { previousWeld, previousWelds }
    },

    onError: (_err, { weldId }, context) => {
      if (context?.previousWeld !== undefined) {
        queryClient.setQueryData(['weld', weldId], context.previousWeld)
      }
      context?.previousWelds.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },

    onSettled: (_data, _err, { weldId }) => {
      queryClient.invalidateQueries({ queryKey: ['weld', weldId] })
      queryClient.invalidateQueries({ queryKey: ['welds'] })
    },
  })
}

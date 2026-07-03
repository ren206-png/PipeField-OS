'use client'
// ============================================================
// useSpools — spool list, detail, and all spool mutations.
//
// Optimistic update strategy:
//   useUpdateSpoolStatus  — optimistically updates status in
//     list and detail caches; rolls back on error.
//   useToggleSpoolItem    — toggles is_cut / is_fitted on the
//     detail cache immediately; rolls back on error.
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { SpoolStatus, SpoolItem, SpoolWithRelations } from '@/types'

// ── Shared query function (also used by usePrefetchSpool) ─────

export async function fetchSpool(id: string): Promise<SpoolWithRelations> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('spools')
    .select('*, projects(name), spool_items(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as SpoolWithRelations
}

// ── Hooks ─────────────────────────────────────────────────────

export function useSpools(filters: {
  projectId?: string
  status?:    SpoolStatus
  search?:    string
  page?:      number
} = {}) {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ['spools', profile?.organization_id, filters],
    staleTime: 30 * 1000, // fabrication status changes frequently — 30 s
    queryFn: async () => {
      if (!profile?.organization_id) return { spools: [] as unknown[], count: 0 }

      const supabase = createClient()
      let query = supabase
        .from('spools')
        .select('*, projects(name)', { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .order('priority',      { ascending: true })
        .order('spool_number',  { ascending: true })

      if (filters.projectId) query = query.eq('project_id', filters.projectId)
      if (filters.status)    query = query.eq('status', filters.status)
      if (filters.search)    query = query.or(
        `spool_number.ilike.%${filters.search}%,area.ilike.%${filters.search}%,isometric_ref.ilike.%${filters.search}%`
      )

      const from = ((filters.page ?? 1) - 1) * 25
      query = query.range(from, from + 24)

      const { data, error, count } = await query
      if (error) throw error
      return { spools: data ?? [], count: count ?? 0 }
    },
    enabled: !!profile?.organization_id,
  })
}

export function useSpool(id: string) {
  return useQuery({
    queryKey: ['spool', id],
    staleTime: 30 * 1000,
    queryFn: () => fetchSpool(id),
    enabled: !!id,
  })
}

// ── Update spool status ───────────────────────────────────────

export function useUpdateSpoolStatus() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({
      spoolId, newStatus, notes,
    }: { spoolId: string; newStatus: SpoolStatus; notes?: string }) => {
      const supabase = createClient()

      const { data: current } = await supabase
        .from('spools')
        .select('status')
        .eq('id', spoolId)
        .single()

      const updateData: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'released') {
        updateData.released_date = new Date().toISOString().split('T')[0]
      }

      const { data, error } = await supabase
        .from('spools')
        .update(updateData)
        .eq('id', spoolId)
        .select()
        .single()
      if (error) throw error

      if (profile) {
        await supabase.from('audit_logs').insert({
          organization_id: profile.organization_id,
          table_name:      'spools',
          record_id:       spoolId,
          action:          'UPDATE',
          previous_values: { status: (current as { status?: string } | null)?.status },
          new_values:      { status: newStatus, notes: notes ?? null },
          performed_by:    profile.id,
        })
      }

      return data
    },

    // ── Optimistic update ─────────────────────────────────────
    onMutate: async ({ spoolId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['spool', spoolId] })
      await queryClient.cancelQueries({ queryKey: ['spools'] })

      const previousSpool  = queryClient.getQueryData(['spool', spoolId])
      const previousSpools = queryClient.getQueriesData({ queryKey: ['spools'] })

      const patch: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'released') {
        patch.released_date = new Date().toISOString().split('T')[0]
      }

      queryClient.setQueryData(['spool', spoolId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        return { ...(old as object), ...patch }
      })

      queryClient.setQueriesData({ queryKey: ['spools'] }, (old: unknown) => {
        if (!old || typeof old !== 'object') return old
        const data = old as { spools?: Array<Record<string, unknown>>; count?: number }
        if (!data.spools) return old
        return {
          ...data,
          spools: data.spools.map(s =>
            s.id === spoolId ? { ...s, ...patch } : s
          ),
        }
      })

      return { previousSpool, previousSpools }
    },

    onError: (_err, { spoolId }, context) => {
      if (context?.previousSpool !== undefined) {
        queryClient.setQueryData(['spool', spoolId], context.previousSpool)
      }
      context?.previousSpools.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },

    onSettled: (_data, _err, { spoolId }) => {
      queryClient.invalidateQueries({ queryKey: ['spool',  spoolId] })
      queryClient.invalidateQueries({ queryKey: ['spools'] })
    },
  })
}

// ── Toggle spool item cut / fitted ────────────────────────────

export function useToggleSpoolItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      field,
      value,
      spoolId,
    }: {
      itemId:  string
      field:   'is_cut' | 'is_fitted'
      value:   boolean
      spoolId: string
    }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('spool_items')
        .update({ [field]: value })
        .eq('id', itemId)
      if (error) throw error
      return { spoolId }
    },

    // ── Optimistic toggle ─────────────────────────────────────
    onMutate: async ({ itemId, field, value, spoolId }) => {
      await queryClient.cancelQueries({ queryKey: ['spool', spoolId] })

      const previousSpool = queryClient.getQueryData<SpoolWithRelations>(['spool', spoolId])

      queryClient.setQueryData<SpoolWithRelations>(['spool', spoolId], old => {
        if (!old) return old
        return {
          ...old,
          spool_items: old.spool_items.map((item: SpoolItem) =>
            item.id === itemId ? { ...item, [field]: value } : item
          ),
        }
      })

      return { previousSpool }
    },

    onError: (_err, { spoolId }, context) => {
      if (context?.previousSpool !== undefined) {
        queryClient.setQueryData(['spool', spoolId], context.previousSpool)
      }
    },

    onSettled: (_data, _err, { spoolId }) => {
      queryClient.invalidateQueries({ queryKey: ['spool', spoolId] })
    },
  })
}

// ── Add spool item ─────────────────────────────────────────────

export function useAddSpoolItem() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async (item: {
      spoolId:      string
      item_number:  number
      item_type:    string
      description:  string
      quantity:     number
      length_in?:   number
      heat_number?: string
      notes?:       string
    }) => {
      if (!profile?.organization_id) throw new Error('Not authenticated')
      const supabase = createClient()
      const { data, error } = await supabase
        .from('spool_items')
        .insert({
          spool_id:        item.spoolId,
          organization_id: profile.organization_id,
          item_number:     item.item_number,
          item_type:       item.item_type,
          description:     item.description,
          quantity:        item.quantity,
          length_in:       item.length_in   ?? null,
          heat_number:     item.heat_number ?? null,
          notes:           item.notes       ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return { data, spoolId: item.spoolId }
    },
    onSuccess: (_data, { spoolId }) => {
      queryClient.invalidateQueries({ queryKey: ['spool', spoolId] })
    },
  })
}

// ── Delete spool item ─────────────────────────────────────────

export function useDeleteSpoolItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, spoolId }: { itemId: string; spoolId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from('spool_items').delete().eq('id', itemId)
      if (error) throw error
      return { spoolId }
    },
    onSuccess: (_data, { spoolId }) => {
      queryClient.invalidateQueries({ queryKey: ['spool', spoolId] })
    },
  })
}

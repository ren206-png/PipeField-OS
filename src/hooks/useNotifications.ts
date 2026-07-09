'use client'
import { apiFetch } from '@/lib/apiFetch'
// ============================================================
// useNotifications — React Query + Supabase Realtime
// Returns: { notifications, unreadCount, markRead, markAllRead, isLoading }
// Realtime: subscribes to INSERT on notifications table filtered
//           by organization_id and invalidates the query cache.
// ============================================================
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export interface DbNotification {
  id:         string
  type:       string
  title:      string
  body:       string
  href:       string | null
  is_read:    boolean
  created_at: string
}

interface NotificationsResponse {
  notifications: DbNotification[]
  unreadCount:   number
}

// ── Legacy alert-aggregator types kept for backward-compatibility ──
export type NotificationSeverity = 'critical' | 'warning' | 'info'
export interface AppNotification {
  id:        string
  severity:  NotificationSeverity
  title:     string
  detail:    string
  href:      string
  category:  string
  createdAt?: string
}

export function useNotifications() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const orgId = profile?.organization_id

  // ── Fetch list via API route ───────────────────────────────
  const query = useQuery<NotificationsResponse>({
    queryKey: ['notifications', orgId],
    enabled:  !!orgId,
    staleTime: 60 * 1000, // 1 min
    queryFn: async () => {
      const res = await apiFetch('/api/notifications')
      if (!res.ok) throw new Error('Failed to fetch notifications')
      return res.json() as Promise<NotificationsResponse>
    },
  })

  // ── Supabase Realtime subscription ────────────────────────
  useEffect(() => {
    if (!orgId) return

    const supabase = createClient()
    // Use a unique channel name per mount to avoid "subscribe after subscribe" errors
    // that occur in React StrictMode or rapid re-renders.
    const channelName = `notifications:org:${orgId}:${Date.now()}`
    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'notifications',
            filter: `organization_id=eq.${orgId}`,
          },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ['notifications', orgId] })
            const n = payload.new as DbNotification
            toast(n.title, { description: n.body })
          }
        )
        .subscribe()
    } catch (err) {
      // Non-fatal: real-time notifications won't update live, but the page still works.
      console.warn('[useNotifications] Realtime subscription failed:', err)
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(() => {/* ignore cleanup errors */})
      }
    }
  }, [orgId, queryClient])

  // ── Mark single read ───────────────────────────────────────
  async function markRead(id: string) {
    await apiFetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
    queryClient.invalidateQueries({ queryKey: ['notifications', orgId] })
  }

  // ── Mark all read ──────────────────────────────────────────
  async function markAllRead() {
    await apiFetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    queryClient.invalidateQueries({ queryKey: ['notifications', orgId] })
  }

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount:   query.data?.unreadCount   ?? 0,
    markRead,
    markAllRead,
    isLoading: query.isLoading,
  }
}

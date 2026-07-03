// ============================================================
// Notification helpers — server-side only
// Uses the admin client (service role) to insert notifications.
// Call fire-and-forget: createNotification(...).catch(() => {})
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'

interface CreateNotificationParams {
  organizationId: string
  userId?: string // omit for org-wide
  type: string
  title: string
  body: string
  href?: string
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    organization_id: params.organizationId,
    user_id:         params.userId ?? null,
    type:            params.type,
    title:           params.title,
    body:            params.body,
    href:            params.href ?? null,
  })
  if (error) throw error
}

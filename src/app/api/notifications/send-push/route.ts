// ============================================================
// POST /api/notifications/send-push
// Send a web push notification to all subscribed users in the
// caller's organization (or a specific user_id if provided).
// TODO(dead-route): No frontend callers found as of 2026-08-30.
//   Exposed as an admin-only utility endpoint; remove if never adopted.
//
// Body:
//   { title, body, url?, tag?, userId? }
//
// Auth: requireAuth — admin / qc_manager / platform_admin only.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import webpush from 'web-push'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Configure VAPID once per cold start
const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY             ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT                 ?? 'mailto:support@pipefield-os.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

const BodySchema = z.object({
  title:  z.string().min(1).max(100),
  body:   z.string().min(1).max(300),
  url:    z.string().optional(),
  tag:    z.string().optional(),
  userId: z.string().uuid().optional(), // if omitted — send to all org subscribers
})

interface PushSubscriptionRow {
  endpoint: string
  p256dh:   string
  auth:     string
}

// Roles permitted to send push notifications to org members
const PUSH_ALLOWED_ROLES = new Set([
  'platform_admin',
  'organization_owner',
  'administrator',
  'project_manager',
  'qa_inspector',
])

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  // Role guard — comment said "admin only" but was never enforced
  if (!PUSH_ALLOWED_ROLES.has(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 503 })
  }

  const { title, body, url, tag, userId } = parsed.data
  const admin = createAdminClient()

  // Fetch subscriptions
  let query = admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('organization_id', caller.organization_id)

  if (userId) query = query.eq('user_id', userId)

  const { data: subs } = await query
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const payload = JSON.stringify({ title, body, url: url ?? '/dashboard', tag: tag ?? 'pipefield' })

  let sent   = 0
  let failed = 0

  await Promise.all(
    (subs as PushSubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 } // 24h TTL
        )
        sent++
      } catch (err) {
        failed++
        // 410 Gone = subscription expired — remove it
        if ((err as { statusCode?: number }).statusCode === 410) {
          void admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    })
  )

  return NextResponse.json({ sent, failed })
}

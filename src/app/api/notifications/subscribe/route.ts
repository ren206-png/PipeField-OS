// ============================================================
// POST /api/notifications/subscribe  — save browser push subscription
// DELETE /api/notifications/subscribe — remove subscription
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
  userAgent: z.string().optional(),
})

// ── POST — upsert subscription ────────────────────────────────
export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = SubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 })
  }

  const { endpoint, keys, userAgent } = parsed.data
  const admin = createAdminClient()

  const { error } = await admin
    .from('push_subscriptions')
    .upsert({
      user_id:         caller.auth_user_id,
      organization_id: caller.organization_id,
      endpoint,
      p256dh:          keys.p256dh,
      auth:            keys.auth,
      user_agent:      userAgent ?? null,
    }, { onConflict: 'user_id,endpoint' })

  if (error) {
    console.error('push_subscriptions upsert error:', error)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

// ── DELETE — remove subscription ──────────────────────────────
export async function DELETE(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json().catch(() => ({})) as { endpoint?: string }
  if (!body.endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', caller.auth_user_id)
    .eq('endpoint', body.endpoint)

  return NextResponse.json({ ok: true })
}

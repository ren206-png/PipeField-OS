// ============================================================
// GET  /api/notifications  — list last 20 notifications + unread count
// PATCH /api/notifications — { markAllRead: true } marks all read
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('notifications')
      .select('id, type, title, body, href, is_read, created_at')
      .eq('organization_id', caller.organization_id)
      .or(`user_id.is.null,user_id.eq.${caller.auth_user_id}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const rows = (data ?? []) as Array<{
      id: string; type: string; title: string; body: string
      href: string | null; is_read: boolean; created_at: string
    }>
    const unreadCount = rows.filter((n) => !n.is_read).length

    return NextResponse.json({ notifications: rows, unreadCount })
  } catch (err) {
    console.error('GET /api/notifications error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await req.json() as Record<string, unknown>
    if (body.markAllRead !== true) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('organization_id', caller.organization_id)
      .or(`user_id.is.null,user_id.eq.${caller.auth_user_id}`)
      .eq('is_read', false)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/notifications error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

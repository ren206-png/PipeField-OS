// ============================================================
// PATCH /api/notifications/[id] — mark a single notification read
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id } = await params
    const body = await req.json() as Record<string, unknown>
    if (body.is_read !== true) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .or(`user_id.is.null,user_id.eq.${caller.auth_user_id}`)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/notifications/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

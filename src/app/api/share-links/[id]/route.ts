// ============================================================
// DELETE /api/share-links/[id] — delete a share link
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 403 })
    }

    const { id } = await params
    const admin = createAdminClient()

    // Verify ownership before deleting
    const { data: link } = await admin
      .from('client_share_links')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!link) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    const { error } = await admin
      .from('client_share_links')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/share-links/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

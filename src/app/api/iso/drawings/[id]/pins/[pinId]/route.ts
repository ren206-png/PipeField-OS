// ============================================================
// DELETE /api/iso/drawings/[id]/pins/[pinId]
// Remove a weld pin from a drawing.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string; pinId: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const { id, pinId } = await params
  const admin = createAdminClient()

  // Verify drawing belongs to caller's org
  const { data: drawing } = await admin
    .from('iso_drawings')
    .select('id')
    .eq('id', id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })

  const { error } = await admin
    .from('iso_weld_pins')
    .delete()
    .eq('id', pinId)
    .eq('drawing_id', id)
    .eq('organization_id', caller.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}

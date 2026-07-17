// ============================================================
// GET /api/iso/drawings/[id]/url
// Returns a signed URL (3600s) for the drawing file.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const { id } = await params
  const admin = createAdminClient()

  // Fetch drawing and verify org ownership
  const { data: drawing, error: fetchError } = await admin
    .from('iso_drawings')
    .select('id, storage_path, organization_id')
    .eq('id', id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })

  const { data: signedData, error: signError } = await admin.storage
    .from('iso-drawings')
    .createSignedUrl(drawing.storage_path as string, 3600)

  if (signError) return NextResponse.json({ error: signError.message }, { status: 500 })

  return NextResponse.json({ url: signedData.signedUrl })
}

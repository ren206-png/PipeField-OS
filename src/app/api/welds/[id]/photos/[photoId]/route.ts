// ============================================================
// DELETE /api/welds/[id]/photos/[photoId]
//   Remove a photo from Supabase Storage and the DB.
//   Caller must belong to the same org as the weld.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'weld-photos'

interface RouteContext {
  params: Promise<{ id: string; photoId: string }>
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id: weldId, photoId } = await params
    const admin = createAdminClient()

    // Fetch the photo, verifying org ownership in the same query
    const { data: photo } = await admin
      .from('weld_photos')
      .select('id, storage_path, organization_id')
      .eq('id', photoId)
      .eq('weld_id', weldId)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Remove from storage (non-fatal — continue to delete DB row)
    const { error: storageError } = await admin.storage
      .from(BUCKET)
      .remove([photo.storage_path as string])

    if (storageError) {
      console.warn('Storage remove failed (continuing):', storageError.message)
    }

    // Delete DB record
    const { error: deleteError } = await admin
      .from('weld_photos')
      .delete()
      .eq('id', photoId)
      .eq('organization_id', caller.organization_id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/welds/[id]/photos/[photoId] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

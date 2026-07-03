// ============================================================
// GET  /api/welds/[id]/photos  → list photos for a weld
// POST /api/welds/[id]/photos  → upload a photo (multipart/form-data)
//   fields: file (File), caption? (string)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { v4 as uuidv4 } from 'uuid'

const MAX_FILE_SIZE   = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES  = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
const BUCKET          = 'weld-photos'

interface RouteContext {
  params: Promise<{ id: string }>
}

// ── GET ───────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id: weldId } = await params
    const admin = createAdminClient()

    // Verify weld belongs to this org
    const { data: weld } = await admin
      .from('welds')
      .select('id')
      .eq('id', weldId)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!weld) {
      return NextResponse.json({ error: 'Weld not found' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('weld_photos')
      .select('*')
      .eq('weld_id', weldId)
      .eq('organization_id', caller.organization_id)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Attach public URL to each record
    const withUrls = (data ?? []).map((photo: Record<string, unknown>) => {
      const { data: urlData } = admin.storage
        .from(BUCKET)
        .getPublicUrl(photo.storage_path as string)
      return { ...photo, public_url: urlData.publicUrl }
    })

    return NextResponse.json(withUrls)
  } catch (err) {
    console.error('GET /api/welds/[id]/photos error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id: weldId } = await params
    const admin = createAdminClient()

    // Verify weld belongs to this org
    const { data: weld } = await admin
      .from('welds')
      .select('id')
      .eq('id', weldId)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!weld) {
      return NextResponse.json({ error: 'Weld not found' }, { status: 404 })
    }

    // Parse multipart
    const formData = await req.formData()
    const file     = formData.get('file')
    const caption  = formData.get('caption')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
    }

    // Validate type
    if (!ACCEPTED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Accepted: JPEG, PNG, WebP, HEIC` },
        { status: 400 },
      )
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10 MB.` },
        { status: 400 },
      )
    }

    const fileId      = uuidv4()
    const ext         = file.name.split('.').pop() ?? 'jpg'
    const storagePath = `${caller.organization_id}/${weldId}/${fileId}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${ext}`

    // Upload to storage using admin client
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)

    // Insert record
    const captionValue = typeof caption === 'string' && caption.trim() ? caption.trim() : null

    const { data: photo, error: insertError } = await admin
      .from('weld_photos')
      .insert({
        organization_id: caller.organization_id,
        weld_id:         weldId,
        storage_path:    storagePath,
        file_name:       file.name,
        file_size:       file.size,
        uploaded_by:     caller.auth_user_id,
        caption:         captionValue,
      })
      .select()
      .single()

    if (insertError) {
      // Attempt to clean up storage on DB failure
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      throw insertError
    }

    return NextResponse.json({ ...photo, public_url: urlData.publicUrl }, { status: 201 })
  } catch (err) {
    console.error('POST /api/welds/[id]/photos error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

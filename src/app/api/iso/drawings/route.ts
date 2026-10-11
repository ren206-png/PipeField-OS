// ============================================================
// GET + POST /api/iso/drawings
// GET: list drawings for a project
// POST: upload a new ISO drawing (multipart/form-data)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 20 * 1024 * 1024 // 20MB

// Validate from MIME type (not user-supplied filename) to prevent double-extension attacks
const MIME_EXT_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png':       'png',
  'image/jpeg':      'jpg',
}

function mimeToExt(mimeType: string): string | null {
  return MIME_EXT_MAP[mimeType] ?? null
}

/** Sanitize drawing_number / revision for safe use in storage paths */
function sanitizePathSegment(value: string, maxLen: number): string {
  return value.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, maxLen)
}

export async function GET(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const projectId = req.nextUrl.searchParams.get('project_id')
  if (!projectId) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify project belongs to org
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('iso_drawings')
    .select('*')
    .eq('organization_id', caller.organization_id)
    .eq('project_id', projectId)
    .order('drawing_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const formData = await req.formData()
  const projectId      = formData.get('project_id') as string | null
  const drawingNumber  = formData.get('drawing_number') as string | null
  const revision       = (formData.get('revision') as string | null) ?? 'A'
  const title          = (formData.get('title') as string | null) ?? null
  const file           = formData.get('file') as File | null

  if (!projectId || !drawingNumber || !file) {
    return NextResponse.json(
      { error: 'project_id, drawing_number, and file are required' },
      { status: 400 },
    )
  }

  // Validate file size
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 413 })
  }

  // Validate from MIME type — never trust the user-supplied filename extension
  const fileExt = mimeToExt(file.type)
  if (!fileExt) {
    return NextResponse.json(
      { error: 'Only PDF, PNG, and JPEG files are allowed' },
      { status: 415 },
    )
  }

  const admin = createAdminClient()

  // Verify project belongs to caller's org
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Sanitize path segments to prevent path traversal attacks
  const safeDrawingNumber = sanitizePathSegment(drawingNumber, 80)
  const safeRevision      = sanitizePathSegment(revision, 20)

  // Build storage path
  const storagePath = `${caller.organization_id}/${projectId}/${safeDrawingNumber}-${safeRevision}.${fileExt}`

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: storageError } = await admin.storage
    .from('iso-drawings')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  // Insert record
  const { data, error } = await admin
    .from('iso_drawings')
    .insert({
      organization_id: caller.organization_id,
      project_id:      projectId,
      drawing_number:  safeDrawingNumber,
      revision:        safeRevision,
      title,
      storage_path:    storagePath,
      file_type:       fileExt,
      uploaded_by:     caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}

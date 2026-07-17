// ============================================================
// GET + POST /api/iso/drawings
// GET: list drawings for a project
// POST: upload a new ISO drawing (multipart/form-data)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['pdf', 'png', 'jpg', 'jpeg'] as const
type FileType = (typeof ALLOWED_TYPES)[number]
const MAX_BYTES = 20 * 1024 * 1024 // 20MB

function extToType(ext: string): FileType | null {
  const lower = ext.toLowerCase().replace('.', '') as FileType
  return ALLOWED_TYPES.includes(lower) ? lower : null
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

  // Determine extension / file type
  const originalName = file.name ?? ''
  const dotIndex = originalName.lastIndexOf('.')
  const ext = dotIndex >= 0 ? originalName.slice(dotIndex + 1) : ''
  const fileType = extToType(ext)
  if (!fileType) {
    return NextResponse.json(
      { error: 'Only pdf, png, jpg, jpeg files are allowed' },
      { status: 400 },
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

  // Build storage path
  const storagePath = `${caller.organization_id}/${projectId}/${drawingNumber}-${revision}.${fileType}`

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: storageError } = await admin.storage
    .from('iso-drawings')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  // Insert record
  const { data, error } = await admin
    .from('iso_drawings')
    .insert({
      organization_id: caller.organization_id,
      project_id:      projectId,
      drawing_number:  drawingNumber,
      revision,
      title,
      storage_path:    storagePath,
      file_type:       fileType,
      uploaded_by:     caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data, { status: 201 })
}

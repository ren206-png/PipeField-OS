// ============================================================
// POST /api/knowledge/upload
// Accepts multipart/form-data with:
//   file            File         (required)
//   title           string       (required)
//   description     string
//   document_type   string
//   related_module  string
//   category_id     string (uuid)
//   project_id      string (uuid)
//   tags            string (JSON array)
//   visibility      string
//   version         string
//
// Follows the same pattern as /api/welds/[id]/photos
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { v4 as uuidv4 } from 'uuid'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const ACCEPTED_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Images (drawings, P&IDs, isometrics)
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/svg+xml',
  // CAD / other
  'application/dxf',
  'application/octet-stream', // generic for DWG, DXF
])

const BUCKET = 'knowledge-docs'

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // Rate limit: 20 uploads per org per hour
    if (!rateLimit({ key: `knowledge-upload:${caller.organization_id}`, limit: 20, windowMs: 60 * 60_000 })) {
      return NextResponse.json({ error: 'Too many uploads. Please wait before uploading more documents.' }, { status: 429 })
    }

    // Require upload permission
    const uploadRoles = [
      'platform_admin', 'organization_owner', 'administrator',
      'project_manager', 'foreman', 'qa_inspector', 'shop_fabricator',
    ]
    if (!uploadRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to upload knowledge' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
    }

    const title = (formData.get('title') as string | null)?.trim()
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Validate MIME type against the allowlist BEFORE checking size
    // (client Content-Type header is untrusted but filters obvious misuse)
    if (!ACCEPTED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Accepted: PDF, Word, Excel, PowerPoint, text, CSV, images.` },
        { status: 415 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50 MB.' }, { status: 400 })
    }

    const description    = (formData.get('description')    as string | null)?.trim() || null
    const document_type  = (formData.get('document_type')  as string | null)?.trim() || 'other'
    const related_module = (formData.get('related_module') as string | null)?.trim() || null
    const category_id    = (formData.get('category_id')    as string | null)?.trim() || null
    const project_id     = (formData.get('project_id')     as string | null)?.trim() || null
    const visibility     = (formData.get('visibility')     as string | null)?.trim() || 'org'
    const version        = (formData.get('version')        as string | null)?.trim() || '1.0'
    const tagsRaw        = formData.get('tags') as string | null
    const tags: string[] = tagsRaw ? JSON.parse(tagsRaw) : []

    const admin = createAdminClient()

    // Build storage path: org/year-month/uuid-safename.ext
    // Extension comes from the validated MIME type — never from user input —
    // to prevent double-extension attacks (e.g. "shell.php.pdf").
    const MIME_TO_EXT: Record<string, string> = {
      'application/pdf':   'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
      'text/csv':   'csv',
      'image/jpeg': 'jpg',
      'image/png':  'png',
      'image/webp': 'webp',
      'image/tiff': 'tiff',
      'image/svg+xml': 'svg',
      'application/dxf': 'dxf',
      'application/octet-stream': 'bin',
    }
    const fileId    = uuidv4()
    const yearMonth = new Date().toISOString().slice(0, 7)
    // Strip all extensions from the original name; keep only alphanumerics
    const baseName  = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'document'
    const ext       = MIME_TO_EXT[file.type] ?? 'bin'
    const storagePath = `${caller.organization_id}/${yearMonth}/${fileId}-${baseName}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath)

    // Insert knowledge_source record
    const { data: source, error: insertError } = await admin
      .from('knowledge_sources')
      .insert({
        organization_id:   caller.organization_id,
        project_id:        project_id || null,
        category_id:       category_id || null,
        title,
        description,
        document_type,
        related_module,
        file_name:         file.name,
        file_size:         file.size,
        file_type:         file.type || 'application/octet-stream',
        storage_path:      storagePath,
        public_url:        urlData.publicUrl,
        tags,
        visibility,
        status:            'active',
        version,
        uploaded_by:       caller.auth_user_id,
        processing_status: 'pending',
      })
      .select()
      .maybeSingle()

    if (insertError) {
      // Clean up orphaned storage file
      await admin.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Audit log
    await admin.from('knowledge_audit_log').insert({
      organization_id: caller.organization_id,
      source_id:       source.id,
      action:          'upload',
      performed_by:    caller.auth_user_id,
      details: {
        file_name:     file.name,
        file_size:     file.size,
        document_type,
        title,
      },
    })

    // Trigger background processing (fire and forget)
    const host    = req.headers.get('host') ?? 'localhost:3000'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${host}`
    fetch(`${baseUrl}/api/knowledge/process/${source.id}`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET ?? ''}`,
        'Content-Type':  'application/json',
      },
    }).catch(() => {}) // fire and forget — errors are handled inside the process route

    return NextResponse.json(source, { status: 201 })
  } catch (err) {
    logger.error('knowledge.upload.failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}

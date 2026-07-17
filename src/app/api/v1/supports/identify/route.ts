// ============================================================
// POST /api/v1/supports/identify
// Flag-gated (PFOS_SUPPORT_PHOTO_ID). Returns 404 when flag is off.
// Accepts multipart/form-data: file, client_photo_id, captured_at_client (optional)
// Full validation before any AI call.
// Deduplicates on (organization_id, client_photo_id).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPPORT_PHOTO_ID_ENABLED } from '@/intelligence/flags'
import { invoke } from '@/intelligence/registry'
import { stripExif } from '@/lib/strip-exif'
import type { SupportPhotoInput, SupportPhotoResponse } from '@/intelligence/adapters/support-photo-id'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
type MimeType = 'image/jpeg' | 'image/png' | 'image/webp'

const MIME_TO_EXT: Record<MimeType, string> = {
  'image/jpeg': 'jpeg',
  'image/png':  'png',
  'image/webp': 'webp',
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  // ── 1. Feature flag gate ──────────────────────────────────
  if (!SUPPORT_PHOTO_ID_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── 2. Auth ───────────────────────────────────────────────
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  // ── 3. Parse multipart ────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  // ── 4. Extract fields ─────────────────────────────────────
  const file            = formData.get('file')
  const clientPhotoIdRaw = formData.get('client_photo_id')
  const capturedAtRaw   = formData.get('captured_at_client')

  // ── 5. Validate client_photo_id ───────────────────────────
  if (typeof clientPhotoIdRaw !== 'string' || !clientPhotoIdRaw.trim()) {
    return NextResponse.json(
      { error: 'MISSING_CLIENT_PHOTO_ID', message: 'client_photo_id is required' },
      { status: 400 },
    )
  }
  const clientPhotoId = clientPhotoIdRaw.trim()

  // ── 6. Validate captured_at_client ────────────────────────
  let capturedAtClient: Date | null = null
  if (typeof capturedAtRaw === 'string' && capturedAtRaw.trim()) {
    const parsed = new Date(capturedAtRaw.trim())
    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: 'INVALID_CAPTURED_AT', message: 'captured_at_client must be a valid ISO timestamp' },
        { status: 422 },
      )
    }
    if (Date.now() - parsed.getTime() > SEVEN_DAYS_MS) {
      return NextResponse.json(
        { error: 'PHOTO_EXPIRED', message: 'Photo is older than 7 days and cannot be processed' },
        { status: 422 },
      )
    }
    capturedAtClient = parsed
  }

  // ── 7. Validate file ──────────────────────────────────────
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'MISSING_FILE', message: 'file field is required' }, { status: 400 })
  }

  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'UNSUPPORTED_MEDIA_TYPE', message: `Accepted types: image/jpeg, image/png, image/webp` },
      { status: 415 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'FILE_TOO_LARGE', message: 'File must be 5 MB or smaller' },
      { status: 413 },
    )
  }

  const mimeType = file.type as MimeType

  // ── 8. Deduplication check ────────────────────────────────
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('support_photo_identifications')
    .select('id, result_status, matched_catalog_id, confidence, visual_indicators')
    .eq('organization_id', caller.organization_id)
    .eq('client_photo_id', clientPhotoId)
    .maybeSingle()

  if (existing) {
    // Idempotent — return the existing result
    let matchedComponent = null
    if (existing.matched_catalog_id) {
      const { data: catalogRow } = await admin
        .from('pipe_support_catalog')
        .select('id, component_name, component_code')
        .eq('id', existing.matched_catalog_id)
        .eq('organization_id', caller.organization_id)
        .maybeSingle()
      if (catalogRow) {
        matchedComponent = {
          id:             catalogRow.id,
          component_name: catalogRow.component_name,
          component_code: catalogRow.component_code,
        }
      }
    }
    return NextResponse.json({
      status:            existing.result_status ?? 'UNIDENTIFIED',
      confidence:        existing.confidence ?? 0,
      visual_indicators: (existing.visual_indicators as string[]) ?? [],
      matched_component: matchedComponent,
      disclaimer:        'AI pre-identification only. Verify against isometrics and support drawings. Not an engineering determination.',
      identification_id: existing.id,
    })
  }

  // ── 9. Read file to Buffer ────────────────────────────────
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  // ── 10. Strip EXIF ────────────────────────────────────────
  const cleanBuffer = stripExif(fileBuffer, mimeType)

  // ── 11. Upload to Supabase Storage ────────────────────────
  const ext         = MIME_TO_EXT[mimeType]
  const storagePath = `${caller.organization_id}/${clientPhotoId}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('support-photos')
    .upload(storagePath, cleanBuffer, { contentType: mimeType, upsert: false })

  if (uploadError) {
    console.error('[support-photo-id] Storage upload failed:', uploadError.message)
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
  }

  // ── 12. Insert initial audit row ──────────────────────────
  const deleteAfter = new Date(Date.now() + SEVEN_DAYS_MS)

  const { data: auditRow, error: insertError } = await admin
    .from('support_photo_identifications')
    .insert({
      organization_id:  caller.organization_id,
      user_id:          caller.id,
      client_photo_id:  clientPhotoId,
      captured_at_client: capturedAtClient?.toISOString() ?? null,
      storage_path:     storagePath,
      delete_after:     deleteAfter.toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !auditRow) {
    // Clean up storage on DB failure
    await admin.storage.from('support-photos').remove([storagePath]).catch(() => {})
    console.error('[support-photo-id] Audit row insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const identificationId = auditRow.id

  // ── 13. Load org catalog ──────────────────────────────────
  const { data: catalogRows, error: catalogError } = await admin
    .from('pipe_support_catalog')
    .select('id, component_name, visual_description')
    .eq('organization_id', caller.organization_id)

  if (catalogError) {
    console.error('[support-photo-id] Catalog load failed:', catalogError.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const catalog = (catalogRows ?? []).map(r => ({
    id:                r.id as string,
    name:              r.component_name as string,
    visual_description: (r.visual_description as string | null) ?? null,
  }))

  // ── 14. Convert to base64 ─────────────────────────────────
  const imageBase64 = cleanBuffer.toString('base64')

  // ── 15. Call Intelligence Engine (one retry on transport error) ──
  const invokeInput: SupportPhotoInput = { imageBase64, mimeType, catalog }
  const invokeCtx = {
    organizationId: caller.organization_id,
    userId:         caller.id,
    authUserId:     caller.auth_user_id,
    // capability and flagState are filled in by the registry; provide placeholders
    // that the registry immediately overwrites before passing to the adapter.
    capability:     'support-photo-id' as const,
    flagState:      {} as Record<string, boolean>,
  }

  let aiResult: SupportPhotoResponse | null = null
  let lastError: string | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await invoke<SupportPhotoInput, SupportPhotoResponse>(
      'support-photo-id',
      invokeCtx,
      invokeInput,
    )

    if (result.ok) {
      aiResult = result.data
      break
    }

    lastError = result.message

    // Do NOT retry on validation or catalog escape errors
    if (
      result.message.includes('VALIDATION_FAILURE') ||
      result.message.includes('CATALOG_ESCAPE')
    ) {
      break
    }

    // Only retry once on transport/engine errors
    if (attempt === 0) {
      console.warn('[support-photo-id] AI call failed, retrying once:', result.message)
      continue
    }
  }

  // Handle specific AI error types
  if (aiResult === null) {
    const isValidationFailure = lastError?.includes('VALIDATION_FAILURE')
    const isCatalogEscape     = lastError?.includes('CATALOG_ESCAPE')

    if (isValidationFailure) {
      console.error('[support-photo-id] AI validation failure:', lastError)
      return NextResponse.json({ error: 'AI_VALIDATION_FAILURE' }, { status: 422 })
    }
    if (isCatalogEscape) {
      console.error('[support-photo-id] Catalog escape detected:', lastError)
      return NextResponse.json({ error: 'CATALOG_ESCAPE' }, { status: 422 })
    }

    // General AI error — return 500
    console.error('[support-photo-id] AI invocation failed after retry:', lastError)
    return NextResponse.json({ error: 'AI invocation failed' }, { status: 500 })
  }

  // ── 16. Fetch full component from DB (never trust model for spec data) ──
  let matchedComponent: { id: string; component_name: string; component_code: string } | null = null

  if (aiResult.status === 'MATCH' && aiResult.component_type_id !== null) {
    const { data: componentRow } = await admin
      .from('pipe_support_catalog')
      .select('id, component_name, component_code')
      .eq('id', aiResult.component_type_id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (componentRow) {
      matchedComponent = {
        id:             componentRow.id as string,
        component_name: componentRow.component_name as string,
        component_code: componentRow.component_code as string,
      }
    }
  }

  // ── 17. Update audit row with results ─────────────────────
  await admin
    .from('support_photo_identifications')
    .update({
      processed_at:      new Date().toISOString(),
      result_status:     aiResult.status,
      matched_catalog_id: matchedComponent?.id ?? null,
      confidence:        aiResult.confidence,
      visual_indicators: aiResult.visual_indicators,
    })
    .eq('id', identificationId)
    .eq('organization_id', caller.organization_id)

  // ── 18. Return response ───────────────────────────────────
  return NextResponse.json({
    status:            aiResult.status,
    confidence:        aiResult.confidence,
    visual_indicators: aiResult.visual_indicators,
    matched_component: matchedComponent,
    disclaimer:        'AI pre-identification only. Verify against isometrics and support drawings. Not an engineering determination.',
    identification_id: identificationId,
  })
}

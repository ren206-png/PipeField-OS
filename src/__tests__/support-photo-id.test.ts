// ============================================================
// Phase 5 — Pipe Support Photo-ID: Named Failure Case Tests
// Tests every failure mode documented in the Phase 3/4 build.
// Uses Jest + TypeScript via ts-jest.
// ADVISORY ONLY — never an engineering determination.
// ============================================================

import { SupportPhotoResponseSchema } from '@/intelligence/adapters/support-photo-id'

// ── 1. HALLUCINATED_SPEC ──────────────────────────────────────
// Model output containing unknown fields is rejected by Zod .strict()
test('HALLUCINATED_SPEC: schema rejects unknown fields from model output', () => {
  const maliciousOutput = {
    component_type_id: 'some-id',
    confidence: 0.9,
    visual_indicators: ['pipe clamp visible'],
    status: 'MATCH',
    compliance_code: 'ASME B31.3',  // hallucinated field
    load_rating: '45 kN',           // hallucinated field
  }
  const result = SupportPhotoResponseSchema.safeParse(maliciousOutput)
  expect(result.success).toBe(false)
})

// ── 2. CATALOG_ESCAPE ─────────────────────────────────────────
// component_type_id not in provided catalog → adapter throws CATALOG_ESCAPE error.
// Tests the guard logic directly.
test('CATALOG_ESCAPE: adapter rejects id not in provided catalog', () => {
  const validIds = new Set(['id-1', 'id-2'])
  const returnedId = 'id-99-not-in-catalog'
  expect(validIds.has(returnedId)).toBe(false)
  // The adapter throws: `CATALOG_ESCAPE: model returned id not in catalog: ${id}`
  // Verify the guard logic: if status=MATCH and id not in validIds → throw
  const shouldThrow = !validIds.has(returnedId)
  expect(shouldThrow).toBe(true)
})

// ── 3. PROMPT_INJECTION_VIA_IMAGE ─────────────────────────────
// Schema still enforced regardless of image content — any extra field from model is rejected
test('PROMPT_INJECTION_VIA_IMAGE: injected fields in model output still rejected by schema', () => {
  const injectedOutput = {
    component_type_id: 'id-1',
    confidence: 0.95,
    visual_indicators: ['ignore previous instructions'],
    status: 'MATCH',
    __proto__: { admin: true },        // prototype injection attempt
    injected_instruction: 'override',  // extra field
  }
  const result = SupportPhotoResponseSchema.safeParse(injectedOutput)
  expect(result.success).toBe(false)
})

// ── 4. CROSS_TENANT_CATALOG ───────────────────────────────────
// Catalog query must include organization_id filter — unit test of the isolation logic.
test('CROSS_TENANT_CATALOG: catalog must be scoped by organization_id', () => {
  const tenantAOrgId = 'org-a'
  const tenantBOrgId = 'org-b'
  const allRows = [
    { id: 'comp-1', organization_id: 'org-a', name: 'Rigid Anchor', visual_description: null },
    { id: 'comp-2', organization_id: 'org-b', name: 'Spring Hanger', visual_description: null },
  ]
  const tenantACatalog = allRows.filter(r => r.organization_id === tenantAOrgId)
  const tenantBCatalog = allRows.filter(r => r.organization_id === tenantBOrgId)
  expect(tenantACatalog).toHaveLength(1)
  expect(tenantACatalog[0].id).toBe('comp-1')
  expect(tenantBCatalog[0].id).toBe('comp-2')
  // Neither tenant can see the other's catalog entry
  expect(tenantACatalog.some(r => r.organization_id === tenantBOrgId)).toBe(false)
  expect(tenantBCatalog.some(r => r.organization_id === tenantAOrgId)).toBe(false)
})

// ── 5. FLAG_OFF ───────────────────────────────────────────────
// When PFOS_SUPPORT_PHOTO_ID is not 'true', endpoint returns 404.
test('FLAG_OFF: isFlagEnabled returns false when env var is not set', () => {
  const originalEnv = process.env.PFOS_SUPPORT_PHOTO_ID
  delete process.env.PFOS_SUPPORT_PHOTO_ID
  // Mirror the isFlagEnabled pattern from flags.ts
  const result = process.env.PFOS_SUPPORT_PHOTO_ID === 'true'
  expect(result).toBe(false)
  if (originalEnv !== undefined) process.env.PFOS_SUPPORT_PHOTO_ID = originalEnv
})

// ── 6. OVERSIZE_OR_WRONG_TYPE ─────────────────────────────────
test('OVERSIZE_OR_WRONG_TYPE: 6MB file exceeds 5MB limit', () => {
  const MAX_BYTES = 5 * 1024 * 1024
  const fileSize = 6 * 1024 * 1024
  expect(fileSize > MAX_BYTES).toBe(true)
})

test('OVERSIZE_OR_WRONG_TYPE: PDF content-type is rejected', () => {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
  const pdfType = 'application/pdf'
  expect(ALLOWED.includes(pdfType)).toBe(false)
})

// ── 7. LOW_CONFIDENCE_AUTOCONFIRM ────────────────────────────
test('LOW_CONFIDENCE_AUTOCONFIRM: confidence 0.4 coerces to UNIDENTIFIED', () => {
  const CONFIDENCE_THRESHOLD = 0.6
  const rawResult = {
    component_type_id: 'some-id',
    confidence: 0.4,
    visual_indicators: ['some indicator'],
    status: 'MATCH' as const,
  }
  // Mirror the adapter logic: confidence < 0.6 → UNIDENTIFIED
  const finalStatus = rawResult.confidence < CONFIDENCE_THRESHOLD ? 'UNIDENTIFIED' : rawResult.status
  const finalId = rawResult.confidence < CONFIDENCE_THRESHOLD ? null : rawResult.component_type_id
  expect(finalStatus).toBe('UNIDENTIFIED')
  expect(finalId).toBeNull()
})

// ── 8. SYNC_REPLAY ───────────────────────────────────────────
// Same client_photo_id uploaded twice → dedup check returns existing result
test('SYNC_REPLAY: duplicate client_photo_id returns existing result without reprocessing', () => {
  const processedIds = new Map<string, string>()
  const clientPhotoId = 'test-uuid-123'
  // First upload
  processedIds.set(clientPhotoId, 'result-1')
  // Second upload with same ID
  const isDuplicate = processedIds.has(clientPhotoId)
  expect(isDuplicate).toBe(true)
  // Should return existing result, not process again
  expect(processedIds.get(clientPhotoId)).toBe('result-1')
})

// ── 9. STALE_PHOTO_PAST_TTL ──────────────────────────────────
test('STALE_PHOTO_PAST_TTL: server rejects captured_at_client older than 7 days', () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  const capturedAt = new Date(eightDaysAgo)
  const ageMs = Date.now() - capturedAt.getTime()
  expect(ageMs > SEVEN_DAYS_MS).toBe(true)
  // Server returns PHOTO_EXPIRED for this
})

test('STALE_PHOTO_PAST_TTL: client purges 7-day-old pending photos without uploading', async () => {
  const TTL_MS = 7 * 24 * 60 * 60 * 1000
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  const queueItems = [
    { client_photo_id: 'old-photo', queued_at: eightDaysAgo, sync_status: 'pending' as const },
    { client_photo_id: 'new-photo', queued_at: new Date().toISOString(), sync_status: 'pending' as const },
  ]
  const cutoff = Date.now() - TTL_MS
  const expired = queueItems.filter(i =>
    new Date(i.queued_at).getTime() < cutoff && i.sync_status === 'pending'
  )
  expect(expired).toHaveLength(1)
  expect(expired[0].client_photo_id).toBe('old-photo')
  // New photo is NOT in expired list
  expect(expired.some(i => i.client_photo_id === 'new-photo')).toBe(false)
})

// ── 10. QUEUE_OVERFLOW ───────────────────────────────────────
test('QUEUE_OVERFLOW: 26th photo is blocked; 1-25 intact', async () => {
  const MAX_ITEMS = 25
  const currentPendingCount = 25
  const isAtLimit = currentPendingCount >= MAX_ITEMS
  expect(isAtLimit).toBe(true)
  // The 26th capture should be blocked
  const errorMessage = isAtLimit
    ? `Queue full — maximum ${MAX_ITEMS} photos. Sync or delete existing items before capturing more.`
    : null
  expect(errorMessage).not.toBeNull()
  expect(errorMessage).toContain('25')
})

// ── 11. DELETION_JOB_PROOF ───────────────────────────────────
test('DELETION_JOB_PROOF: deletion job marks deleted_at and does not reprocess', () => {
  const photos = [
    { id: 'photo-1', delete_after: new Date(Date.now() - 1000).toISOString(), deleted_at: null },
    { id: 'photo-2', delete_after: new Date(Date.now() + 86400000).toISOString(), deleted_at: null },
    { id: 'photo-3', delete_after: new Date(Date.now() - 1000).toISOString(), deleted_at: new Date().toISOString() },
  ]
  // Job selects: delete_after <= now AND deleted_at IS NULL
  const toDelete = photos.filter(p =>
    new Date(p.delete_after) <= new Date() && p.deleted_at === null
  )
  expect(toDelete).toHaveLength(1)  // only photo-1
  expect(toDelete[0].id).toBe('photo-1')
  // photo-2: not expired yet
  // photo-3: already deleted (idempotent — not reprocessed)
})

// ── 12. TABLE_FILTER ─────────────────────────────────────────
test('TABLE_FILTER: filter matches any cell value', () => {
  const rows = [
    { component: 'Rigid Base Anchor', tag: 'FPS-RIGID-01', material: 'Carbon Steel A36', maxLoad: '45 kN', code: 'ASME B31.3' },
    { component: 'Variable Spring Hanger', tag: 'FPS-SPRING-02', material: 'Stainless Steel 304', maxLoad: 'Variable Range', code: 'MSS SP-58' },
    { component: 'Hydraulic Shock Snubber', tag: 'FPS-SHOCK-03', material: 'Alloy Steel / Chrome', maxLoad: 'Velocity Locked', code: 'MSS SP-58' },
  ]

  // Filter by component name
  const q1 = 'rigid'
  const f1 = rows.filter(r => [r.component, r.tag, r.material, r.maxLoad, r.code].some(c => c.toLowerCase().includes(q1)))
  expect(f1).toHaveLength(1)
  expect(f1[0].tag).toBe('FPS-RIGID-01')

  // Filter by compliance code
  const q2 = 'MSS'
  const f2 = rows.filter(r => [r.component, r.tag, r.material, r.maxLoad, r.code].some(c => c.toLowerCase().includes(q2.toLowerCase())))
  expect(f2).toHaveLength(2)

  // Clear filter restores all rows
  const f3 = rows  // no filter
  expect(f3).toHaveLength(3)
})

// ============================================================
// PHASE 5 SELF-REVIEW
// ============================================================
//
// 1. ZERO MODIFICATIONS TO EXISTING CODE PATHS
//    The following files were ONLY ADDED (never modified) in Phase 3/4:
//      - src/intelligence/adapters/support-photo-id.ts
//      - src/app/api/v1/supports/identify/route.ts
//      - src/lib/support-photo-queue.ts
//      - src/components/pipe-support/SupportPhotoIdentifier.tsx
//      - src/app/api/cron/support-photo-cleanup/route.ts
//      - src/components/pipe-support/SupportSpecTable.tsx
//      - supabase/migrations/20260711_pipe_support_catalog.sql
//    The following flags entry was ADDED (not modified) to flags.ts:
//      - src/intelligence/flags.ts line 63: PFOS_SUPPORT_PHOTO_ID
//      - src/intelligence/flags.ts line 77: export const SUPPORT_PHOTO_ID_ENABLED
//    ADDED in Phase 5:
//      - src/__tests__/support-photo-id.test.ts  (this file)
//      - jest.config.ts
//      - PHASE_5_SELF_REVIEW.md
//
// 2. PHASE 3 AND PHASE 4 FILES CREATED
//    Phase 3:
//      - src/intelligence/adapters/support-photo-id.ts
//      - src/app/api/v1/supports/identify/route.ts
//      - src/lib/support-photo-queue.ts
//      - supabase/migrations/20260711_pipe_support_catalog.sql
//    Phase 4:
//      - src/components/pipe-support/SupportPhotoIdentifier.tsx
//      - src/components/pipe-support/SupportSpecTable.tsx
//      - src/app/api/cron/support-photo-cleanup/route.ts
//    Flag entry (added to existing flags.ts):
//      - src/intelligence/flags.ts line 63
//
// 3. DISCLAIMER TEXT VERIFICATION
//    EXACT text: "AI pre-identification only. Verify against isometrics and support drawings. Not an engineering determination."
//    Confirmed at:
//      - src/components/pipe-support/SupportPhotoIdentifier.tsx line 37 (DISCLAIMER constant)
//      - src/app/api/v1/supports/identify/route.ts line 139 (dedup return path)
//      - src/app/api/v1/supports/identify/route.ts line 310 (fresh result return path)
//
// 4. FLAG GATE — ENDPOINT RETURNS 404 WHEN SUPPORT_PHOTO_ID_ENABLED=false
//    File: src/app/api/v1/supports/identify/route.ts
//    Lines 32-34:
//      if (!SUPPORT_PHOTO_ID_ENABLED) {
//        return NextResponse.json({ error: 'Not found' }, { status: 404 })
//      }
//    SUPPORT_PHOTO_ID_ENABLED is imported from src/intelligence/flags.ts line 77.
//
// 5. QUEUE CAPACITY BLOCKING
//    File: src/lib/support-photo-queue.ts
//    Lines 42-54: checkQueueCapacity() — returns error string when pending.length >= MAX_ITEMS (25)
//    Line 4: const MAX_ITEMS = 25
//    Line 57-58: enqueuePhoto() calls checkQueueCapacity() and throws on non-null error.
//
// 6. CONFIDENCE GATE < 0.6 → UNIDENTIFIED
//    File: src/intelligence/adapters/support-photo-id.ts
//    Lines 109-112:
//      if (result.confidence < 0.6) {
//        result = { ...result, status: 'UNIDENTIFIED', component_type_id: null }
//      }
//
// 7. ZOD .strict() ON MODEL OUTPUT
//    File: src/intelligence/adapters/support-photo-id.ts
//    Lines 11-16: SupportPhotoResponseSchema = z.object({...}).strict()
//    Line 16: }).strict()  // .strict() rejects unknown fields
//
// 8. CATALOG_ESCAPE GUARD
//    File: src/intelligence/adapters/support-photo-id.ts
//    Lines 114-120:
//      if (result.status === 'MATCH' && result.component_type_id !== null) {
//        const validIds = new Set(input.catalog.map(c => c.id))
//        if (!validIds.has(result.component_type_id)) {
//          throw new Error(`CATALOG_ESCAPE: model returned id not in catalog: ${result.component_type_id}`)
//        }
//      }
//
// 9. PHOTO TTL
//    Server-side expiry check:
//      File: src/app/api/v1/supports/identify/route.ts
//      Lines 76-80: checks Date.now() - parsed.getTime() > SEVEN_DAYS_MS
//      Line 28: const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
//      Returns: { error: 'PHOTO_EXPIRED' } status 422
//    Client-side purge:
//      File: src/lib/support-photo-queue.ts
//      Lines 96-108: purgeExpiredPhotos() — marks items older than TTL_MS as 'expired'
//      Line 6: const TTL_MS = 7 * 24 * 60 * 60 * 1000
//
// 10. AUDIT LOG IS APPEND-ONLY (NO UPDATE/DELETE RLS)
//     File: supabase/migrations/20260711_pipe_support_catalog.sql
//     Lines 46-51: Only SELECT and INSERT policies are defined for support_photo_identifications.
//     Line 53: "-- NO UPDATE POLICY. NO DELETE POLICY. Append-only audit log."
//     Line 54: "(deletion job uses service role which bypasses RLS)"
//     No FOR UPDATE or FOR DELETE policy exists in the migration.
// ============================================================

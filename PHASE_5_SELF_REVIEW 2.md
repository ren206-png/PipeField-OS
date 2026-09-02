# Phase 5 Self-Review — Pipe Support Photo-ID

## 1. Zero Modifications to Existing Code Paths

The following files were **ONLY ADDED** (never modified) in Phase 3/4:

| File | Status |
|------|--------|
| `src/intelligence/adapters/support-photo-id.ts` | ADDED |
| `src/app/api/v1/supports/identify/route.ts` | ADDED |
| `src/lib/support-photo-queue.ts` | ADDED |
| `src/components/pipe-support/SupportPhotoIdentifier.tsx` | ADDED |
| `src/app/api/cron/support-photo-cleanup/route.ts` | ADDED |
| `src/components/pipe-support/SupportSpecTable.tsx` | ADDED |
| `supabase/migrations/20260711_pipe_support_catalog.sql` | ADDED |

The following entry was **ADDED** (not modified) to `src/intelligence/flags.ts`:
- Line 63: `PFOS_SUPPORT_PHOTO_ID: process.env.PFOS_SUPPORT_PHOTO_ID === 'true'`
- Line 77: `export const SUPPORT_PHOTO_ID_ENABLED = isFlagEnabled('PFOS_SUPPORT_PHOTO_ID')`

Added in Phase 5:
- `src/__tests__/support-photo-id.test.ts` — ADDED
- `jest.config.ts` — ADDED
- `PHASE_5_SELF_REVIEW.md` — ADDED (this file)

---

## 2. Phase 3 and Phase 4 Files Created

**Phase 3 (server-side):**
- `src/intelligence/adapters/support-photo-id.ts` — Zod schema, confidence gate, CATALOG_ESCAPE guard
- `src/app/api/v1/supports/identify/route.ts` — POST endpoint, flag gate, EXIF strip, AI call, dedup
- `src/lib/support-photo-queue.ts` — IndexedDB queue, capacity check, TTL purge
- `supabase/migrations/20260711_pipe_support_catalog.sql` — catalog + audit log tables, RLS, indexes
- `src/intelligence/flags.ts` (line 63 + 77) — PFOS_SUPPORT_PHOTO_ID flag entry

**Phase 4 (client-side + cron):**
- `src/components/pipe-support/SupportPhotoIdentifier.tsx` — photo capture UI, offline queue, sync, disclaimer
- `src/components/pipe-support/SupportSpecTable.tsx` — filterable spec reference table
- `src/app/api/cron/support-photo-cleanup/route.ts` — deletion cron job, marks deleted_at idempotently

---

## 3. Disclaimer Text Verification

**EXACT text confirmed:**
> "AI pre-identification only. Verify against isometrics and support drawings. Not an engineering determination."

Locations:
- `src/components/pipe-support/SupportPhotoIdentifier.tsx` **line 37** — `const DISCLAIMER = '...'`
- `src/app/api/v1/supports/identify/route.ts` **line 139** — dedup (existing result) return path
- `src/app/api/v1/supports/identify/route.ts` **line 310** — fresh AI result return path

---

## 4. Flag Gate — Endpoint Returns 404 When SUPPORT_PHOTO_ID_ENABLED=false

**File:** `src/app/api/v1/supports/identify/route.ts`
**Lines 32–34:**
```typescript
if (!SUPPORT_PHOTO_ID_ENABLED) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
```
`SUPPORT_PHOTO_ID_ENABLED` is imported from `src/intelligence/flags.ts` line 77, which evaluates `process.env.PFOS_SUPPORT_PHOTO_ID === 'true'` at module load time.

---

## 5. Queue Capacity Blocking

**File:** `src/lib/support-photo-queue.ts`
- **Line 4:** `const MAX_ITEMS = 25`
- **Lines 42–54:** `checkQueueCapacity()` — returns error string when `pending.length >= MAX_ITEMS`
- **Lines 57–58:** `enqueuePhoto()` calls `checkQueueCapacity()` and throws on non-null return

Error message: `Queue full — maximum 25 photos. Sync or delete existing items before capturing more.`

---

## 6. Confidence Gate < 0.6 → UNIDENTIFIED

**File:** `src/intelligence/adapters/support-photo-id.ts`
**Lines 109–112:**
```typescript
if (result.confidence < 0.6) {
  result = { ...result, status: 'UNIDENTIFIED', component_type_id: null }
}
```
This runs after Zod validation and before the CATALOG_ESCAPE guard, ensuring low-confidence results never escape as false MATCHes.

---

## 7. Zod .strict() on Model Output

**File:** `src/intelligence/adapters/support-photo-id.ts`
**Lines 11–16:**
```typescript
export const SupportPhotoResponseSchema = z.object({
  component_type_id: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  visual_indicators: z.array(z.string()).max(10),
  status: z.enum(['MATCH', 'UNIDENTIFIED']),
}).strict()  // .strict() rejects unknown fields
```
Any hallucinated field (`compliance_code`, `load_rating`, etc.) or injected field causes `safeParse` to return `success: false`.

---

## 8. CATALOG_ESCAPE Guard

**File:** `src/intelligence/adapters/support-photo-id.ts`
**Lines 114–120:**
```typescript
if (result.status === 'MATCH' && result.component_type_id !== null) {
  const validIds = new Set(input.catalog.map(c => c.id))
  if (!validIds.has(result.component_type_id)) {
    throw new Error(`CATALOG_ESCAPE: model returned id not in catalog: ${result.component_type_id}`)
  }
}
```
The endpoint catches this and returns HTTP 422 with `{ error: 'CATALOG_ESCAPE' }` (route.ts lines 261–263).

---

## 9. Photo TTL

**Server-side expiry check:**
- **File:** `src/app/api/v1/supports/identify/route.ts`
- **Line 28:** `const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000`
- **Lines 76–80:** Checks `Date.now() - parsed.getTime() > SEVEN_DAYS_MS` → returns HTTP 422 `{ error: 'PHOTO_EXPIRED' }`

**Client-side purge (without uploading):**
- **File:** `src/lib/support-photo-queue.ts`
- **Line 6:** `const TTL_MS = 7 * 24 * 60 * 60 * 1000`
- **Lines 96–108:** `purgeExpiredPhotos()` — marks items older than TTL as `'expired'` status without uploading them

---

## 10. Audit Log is Append-Only (No UPDATE/DELETE RLS)

**File:** `supabase/migrations/20260711_pipe_support_catalog.sql`
- **Lines 46–47:** `CREATE POLICY "support_photo_id_org_read"` — FOR SELECT only
- **Lines 50–51:** `CREATE POLICY "support_photo_id_org_insert"` — FOR INSERT only
- **Line 53:** `-- NO UPDATE POLICY. NO DELETE POLICY. Append-only audit log.`
- **Line 54:** `-- (deletion job uses service role which bypasses RLS)`

There is no `FOR UPDATE` or `FOR DELETE` RLS policy on `support_photo_identifications`. The deletion cron job (`src/app/api/cron/support-photo-cleanup/route.ts`) uses `createAdminClient()` (service role) which bypasses RLS entirely — intentional and documented.

# Phase 0 — Read-Only Analysis: PipeField OS Support Photo ID
**Date:** 2026-07-14  
**Scope:** Zero code changes. Analysis only.  
**Analyst:** Claude Sonnet 4.6

---

## 1. Support Reference Page Location

### Files

| Path | Purpose |
|------|---------|
| `src/app/(dashboard)/pipe-reference/page.tsx` | The pipe reference page (`/pipe-reference`) — 575 lines, fully client component |
| `src/app/(dashboard)/pipe-support/page.tsx` | The pipe support calculator page (`/pipe-support`) |

### Pipe Reference Page — Insertion Point

The `/pipe-reference` page (`src/app/(dashboard)/pipe-reference/page.tsx`) is a single-file client component. It returns a `<div className="max-w-6xl mx-auto space-y-5">` root. The last JSX before the closing `</div>` of the `return()` at **line 569–572**:

```tsx
      {/* Source citation footer */}
      <p className="text-[10px] text-surface-600 text-center pb-4">
        Reference data sourced from ASME B36.10M, B36.19M, B16.9, B16.5, B16.10 and MSS SP-69 [sample values — verify before use]
      </p>
    </div>        ← line 573, closing root div
  )              ← line 574, closing return
}                ← line 575, closing function
```

**Insertion point for Phase 1 markup:** Insert new JSX immediately **before line 569** (the `{/* Source citation footer */}` comment), keeping the footer last. This is a purely additive sibling element inside the existing root `<div>`.

The pipe support calculator page (`src/app/(dashboard)/pipe-support/page.tsx`) is a thin wrapper that renders `<SupportCalculator />` inside `<Suspense>`. The actual UI is in `src/components/pipe-support/SupportCalculator.tsx`. The insertion point for a photo-identification panel is **after line 128** in `SupportCalculator.tsx` (after the `</>` closing the `result` branch) and before the `<SaveCalculationModal>` block at line 131.

### Tailwind Confirmation

`tailwind.config.ts` is present at repo root (line 1: `import type { Config } from 'tailwindcss'`). Content paths cover `src/app/**` and `src/components/**`. Custom tokens confirmed: `brand.*`, `surface.*`, `success`, `warning`, `danger`, `info`. Tailwind is fully loaded.

### Class Name Collision Check

A grep for `support-visual-grid` and `support-data-table` across all `.tsx`, `.ts`, and `.css` files returned **zero matches**. No collisions. These class names are safe to introduce.

**GAPS:**
- No `/pipe-support` reference page exists — the support content is a calculator, not a reference library. Phase 1 must decide whether to add the visual catalog to `/pipe-reference` (the reference library) or `/pipe-support` (the calculator). Both insertion points are documented above.

---

## 2. Intelligence Engine Facade

### Files

```
src/intelligence/
  index.ts          ← public API (re-exports)
  registry.ts       ← invoke(), describe(), listCapabilities()
  flags.ts          ← isFlagEnabled(), FLAGS, getFlagSnapshot()
  types.ts          ← all shared types and interfaces
  client.ts         ← OpenAI client + MODELS constants
  accounting.ts     ← daily token budget logic
  audit.ts          ← logInvocation()
  policy.ts         ← (policy helpers)
  tier.ts           ← getOrgTier(), isTierAllowed(), tierBlockedMessage()
  adapters/         ← 16 adapter files (see below)
  engines/          ← engine helpers
```

### `invoke()` Signature

`src/intelligence/registry.ts` lines 74–78:

```ts
export async function invoke<TInput, TOutput>(
  capability: CapabilityName,
  ctx:        InvocationContext,
  input:      TInput,
): Promise<RegistryResult<TOutput>>
```

Never throws. Returns `{ ok: true, data, tokensUsed, latencyMs, model }` on success or `{ ok: false, reason, message }` on any failure.

### Adapter Interface

`src/intelligence/types.ts` lines 58–61:

```ts
export interface CapabilityAdapter<TInput, TOutput> {
  descriptor: CapabilityDescriptor
  invoke(ctx: InvocationContext, input: TInput): Promise<AdapterResult<TOutput>>
}
```

### Adapter Registration Pattern

1. Create a file at `src/intelligence/adapters/<name>.ts` exporting a `const <name>Adapter: CapabilityAdapter<Input, Output>` object.
2. Import and add to `REGISTRY` map in `src/intelligence/registry.ts` lines 43–59:
   ```ts
   const REGISTRY = new Map<CapabilityName, CapabilityAdapter<any, any>>([
     ['rag-qa', ragQaAdapter],
     // ...
     ['support-photo-id', supportPhotoIdAdapter],  // ← new entry
   ])
   ```
3. Add the capability name to the `CapabilityName` union in `src/intelligence/types.ts` lines 9–23.
4. Export input/output types from `src/intelligence/index.ts`.

**Example — `rag-qa` adapter** (`src/intelligence/adapters/rag-qa.ts`):
- Exports `RagQaInput`, `RagQaOutput`, `ragQaAdapter`
- `ragQaAdapter.descriptor` has `name`, `status: 'ACTIVE'`, `requiredTiers`, `dailyTokenBudget`
- `ragQaAdapter.invoke(ctx, input)` does work, returns `AdapterResult<RagQaOutput>`

### Exact Import Path

```ts
import { invoke } from '@/intelligence'
// OR, inside a server route that constructs the context:
import { invoke, type RagQaInput } from '@/intelligence'
```

The `index.ts` comment (line 5–7) enforces: **server-side only**. Never import in client components.

**GAPS:**
- `CapabilityName` union (`src/intelligence/types.ts` lines 9–23) must be extended with `'support-photo-id'` — that is a one-line additive change to the union type, not a breaking change.

---

## 3. File Upload Handling

### Existing Upload Endpoints

| File | Route | Max Size | Accepted Types |
|------|-------|----------|---------------|
| `src/app/api/knowledge/upload/route.ts` | `POST /api/knowledge/upload` | 50 MB (line 26) | PDF, Word, Excel, PPT, text, CSV, JPEG, PNG, WebP, TIFF, SVG, DXF, OctetStream |
| `src/app/api/welds/[id]/photos/route.ts` | `POST /api/welds/[id]/photos` | 10 MB (line 14) | JPEG, PNG, WebP, HEIC |
| `src/app/api/iso/drawings/route.ts` | ISO drawings upload | — | — |
| `src/app/api/excel/import/*/route.ts` | Excel imports (3 routes) | — | .xlsx |

### Weld Photos Upload — Canonical Pattern

`src/app/api/welds/[id]/photos/route.ts`:
- Line 97: `const formData = await req.formData()`
- Line 14: `const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB`
- Line 15: `const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])`
- Line 16: `const BUCKET = 'weld-photos'`
- Lines 123–131: Extension derived from validated MIME type (not user input) to block double-extension attacks
- Lines 134–145: Upload via `admin.storage.from(BUCKET).upload(storagePath, arrayBuffer, { contentType, upsert: false })`
- Lines 168–169: On DB failure, removes orphaned storage file
- Auth: `requireAuth(req)` called first; org-scoped storage path `{org_id}/{weld_id}/{uuid}.{ext}`

### Content-Type Check Pattern

Both upload routes validate MIME type against an allowlist **before** size check (knowledge upload, line 88; photos upload, line 106–110). Extension is never taken from the user-supplied filename.

### EXIF Stripping

**MISSING.** Neither `sharp`, `piexif`, `exifr`, nor any EXIF-stripping library is imported anywhere in the codebase. Photos are stored as-is. This is a gap — images uploaded from mobile devices (especially iOS) may contain GPS coordinates in EXIF metadata.

### Storage Backend

Supabase Storage (self-hosted or cloud). Buckets confirmed: `weld-photos` (line 16, photos route), `knowledge-docs` (line 50, knowledge upload route). The Supabase dashboard/config controls encryption at rest; the application code does not configure it. The privacy page (`src/app/privacy/page.tsx`) states "TLS encryption in transit" but does not explicitly confirm storage-level encryption.

### Reusable Upload Helpers

No shared upload utility module exists. The weld-photos route (`src/app/api/welds/[id]/photos/route.ts`) is the de facto canonical pattern (auth → MIME check → size check → org-scoped path → Supabase storage upload → DB insert → cleanup on error). The new support-photo upload route should follow this exact pattern.

**GAPS:**
- No EXIF stripping. Must be added for support photos (location metadata in field photos is a privacy risk).
- No shared upload helper function — each route duplicates the pattern. A reusable `uploadToStorage()` helper in `src/lib/storage.ts` would be additive.
- Storage encryption at rest: depends on Supabase project config, not visible in source. Confirm in Supabase dashboard.

---

## 4. Offline Sync Mechanism

### Files

| File | Purpose |
|------|---------|
| `src/lib/offline-queue.ts` | IndexedDB schema and queue CRUD operations |
| `src/hooks/useOfflineSync.ts` | React hook — triggers sync, handles results |
| `src/app/(dashboard)/offline-queue/` | Dashboard page (directory exists) |

### Queue Structure

`src/lib/offline-queue.ts` lines 4–20:

```ts
interface WeldQueueItem {
  local_id:    string             // crypto.randomUUID()
  project_id:  string
  payload:     Record<string, unknown>
  created_at:  string            // ISO string
  sync_status: 'pending' | 'synced' | 'failed'
  sync_error?: string
  synced_at?:  string
}

interface PipeFieldDB extends DBSchema {
  weld_queue: {
    key:     string
    value:   WeldQueueItem
    indexes: { 'by-sync-status': string; 'by-project': string }
  }
}
```

IndexedDB database name: `pipefield-offline`, version `1` (line 26). Single object store: `weld_queue`.

### Exported Functions

| Function | Signature | Line |
|----------|-----------|------|
| `enqueueWeld` | `(projectId: string, payload: Record<string, unknown>) => Promise<string>` | 37 |
| `getPendingItems` | `(projectId?: string) => Promise<WeldQueueItem[]>` | 47 |
| `getAllQueueItems` | `() => Promise<WeldQueueItem[]>` | 56 |
| `markSynced` | `(localId: string) => Promise<void>` | 61 |
| `markFailed` | `(localId: string, error: string) => Promise<void>` | 67 |
| `markPending` | `(localId: string) => Promise<void>` | 73 |
| `clearSynced` | `() => Promise<number>` | 79 |

### Sync Trigger (`useOfflineSync.ts`)

`src/hooks/useOfflineSync.ts` lines 34–44:
- **Online event:** `window.addEventListener('online', onOnline)` → calls `sync()`
- **Visibility change:** `document.addEventListener('visibilitychange', onVisible)` → calls `sync()` when tab becomes visible
- **On mount:** `if (navigator.onLine) void sync()` — syncs immediately if online

### Retry Pattern

`useOfflineSync.ts` lines 21–29: Single-pass sync with no automatic retry. Items marked `'failed'` via `markFailed()` stay failed until manually re-queued with `markPending()`. No exponential backoff. No retry loop.

### Sync Endpoint

`useOfflineSync.ts` line 15: syncs to `POST /api/welds/sync-queue`. This is weld-specific.

**GAPS:**
- The queue is weld-only (object store `weld_queue`, endpoint `/api/welds/sync-queue`). The photo queue MUST NOT reuse this store — see Section 9 for the additive alternative.
- No exponential backoff / retry for failed items.

---

## 5. Scheduled Job Infrastructure

### `vercel.json` Cron Entries

`vercel.json` lines 3–10:

```json
"crons": [
  { "path": "/api/cron/daily-digest",   "schedule": "0 6 * * *"    },
  { "path": "/api/cron/health-monitor", "schedule": "*/5 * * * *"  }
]
```

### Existing Cron Route Files

| File | Route | Schedule | Method |
|------|-------|----------|--------|
| `src/app/api/cron/daily-digest/route.ts` | `/api/cron/daily-digest` | 06:00 UTC daily | `GET` |
| `src/app/api/cron/health-monitor/route.ts` | `/api/cron/health-monitor` | Every 5 min | `POST` |

### Auth Pattern (CRON_SECRET)

`src/app/api/cron/daily-digest/route.ts` lines 309–313:

```ts
const authHeader = req.headers.get('authorization') ?? ''
const cronSecret = process.env.CRON_SECRET
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

`health-monitor` uses the same pattern (lines 28–31). Both use `GET`/`POST` depending on the Vercel cron invocation. The `CRON_SECRET` env var must be set.

### Proposed 7-Day Photo Deletion Job

**File to create:** `src/app/api/cron/support-photo-cleanup/route.ts`  
**vercel.json entry to add:**
```json
{ "path": "/api/cron/support-photo-cleanup", "schedule": "0 3 * * *" }
```
(03:00 UTC daily — off-peak, non-conflicting with existing 06:00 digest and 5-min monitor)

Pattern: copy the CRON_SECRET guard from `daily-digest/route.ts` lines 309–313, then query support photo records older than 7 days and delete from Supabase Storage + DB row.

**GAPS:**
- No existing photo-deletion infrastructure. The 7-day cleanup is entirely new.
- Two cron slots are currently used; Vercel Hobby allows only 2. Pro plan required to add a third cron job.

---

## 6. Support Catalog Schema

### Database Search Results

A search across all files in `supabase/` (migrations and root SQL files) for the strings `pipe_support`, `support_type`, `component_type`, `pipe_support_catalog`, and `visual_description` returned **zero matches**. No support catalog table exists in any migration.

The existing pipe-support feature is purely a calculation engine (server-side TypeScript in `src/lib/calculator/pipe-support-calcs.ts` and `src/app/api/pipe-support/`). There is no database-backed catalog of support types.

### What Does Exist

- `src/config/pipe-data.ts` — static reference data (NPS sizes, OD table, wall table)
- `src/config/reference-data.ts` — static reference data (flanges, valves, SP-69 span table)
- `src/app/api/pipe-support/calculations/route.ts` — saves calculation results (not a catalog)

### `organization_id` for Tenant Scoping

All existing feature tables use `organization_id` FK to `organizations(id)`. The intelligence engine (`supabase/migrations/20260708_intelligence_engine.sql` line 37) confirms the pattern. Any new `pipe_support_catalog` table must include `organization_id uuid NOT NULL REFERENCES organizations(id)` plus a corresponding RLS policy.

### Proposed Additive Migration

```sql
-- supabase/migrations/20260715_pipe_support_catalog.sql
CREATE TABLE IF NOT EXISTS pipe_support_catalog (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  support_type        text NOT NULL,          -- e.g. 'u-bolt', 'pipe-shoe', 'spring-hanger'
  component_type      text,                   -- e.g. 'hanger', 'guide', 'anchor'
  nps_min             text,                   -- minimum NPS (from NPS_SIZES)
  nps_max             text,                   -- maximum NPS
  visual_description  text,                   -- plain-text description for AI prompt context
  photo_url           text,                   -- reference photo (public URL)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON pipe_support_catalog(organization_id);

ALTER TABLE pipe_support_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read their catalog"
  ON pipe_support_catalog FOR SELECT
  USING (organization_id = public.get_my_org_id());
```

**GAPS:**
- No `pipe_support_catalog` table. Must be created.
- No `visual_description` column (does not exist because the table does not exist).
- No `organization_id` scoping for catalog (does not exist because the table does not exist).
- No support-photo storage bucket.

---

## 7. Feature Flag Mechanism

### Full Pattern

`src/intelligence/flags.ts`:

```ts
export const FLAGS = {
  PFOS_INTELLIGENCE_ENGINE_ENABLED: process.env.PFOS_INTELLIGENCE_ENGINE_ENABLED === 'true',
  // ... all flags follow this pattern
} as const

export type FlagName = keyof typeof FLAGS

export function isFlagEnabled(flag: FlagName): boolean {
  return FLAGS[flag]
}

export function getFlagSnapshot(): Record<FlagName, boolean> {
  return { ...FLAGS }
}
```

- All flags default to `false` (OFF) unless the env var equals the string `'true'`.
- Exception: `PFOS_BILLING_WELDER_LIMIT` defaults `true` unless env var equals `'false'` (line 54).
- `FLAGS` is `as const` — the type is a read-only record, not a mutable object.
- `FlagName` is `keyof typeof FLAGS` — adding a new entry automatically extends the type.

### Example Existing Flag to Mirror

`src/intelligence/flags.ts` lines 28–29:

```ts
PFOS_INTELLIGENCE_INSPECTION: process.env.PFOS_INTELLIGENCE_INSPECTION === 'true',
```

### New Flag for `SUPPORT_PHOTO_ID`

Add to `FLAGS` object in `src/intelligence/flags.ts` (additive — no existing line changes):

```ts
// Support Photo Identification — AI-assisted support type ID from camera photo
PFOS_SUPPORT_PHOTO_ID: process.env.PFOS_SUPPORT_PHOTO_ID === 'true',
```

The `FlagName` type and `getFlagSnapshot()` function require no changes — they derive from the `FLAGS` object automatically.

**GAPS:**
- `PFOS_SUPPORT_PHOTO_ID` does not yet exist in `flags.ts`. It must be added (additive line).

---

## 8. Proposed Insertion Points

### Endpoint: `POST /api/v1/supports/identify`

**File to create:** `src/app/api/v1/supports/identify/route.ts`

This is a new directory and file — purely additive. Pattern: follow `src/app/api/welds/[id]/photos/route.ts` for the multipart upload portion, then call `invoke('support-photo-id', ctx, input)` from `@/intelligence`. Return the AI result plus a temporary storage URL.

### Adapter: New Intelligence Engine Adapter

**File to create:** `src/intelligence/adapters/support-photo-id.ts`

Mirror the structure of `src/intelligence/adapters/inspection.ts`:
- Export `SupportPhotoIdInput`, `SupportPhotoIdOutput`
- Export `supportPhotoIdAdapter: CapabilityAdapter<SupportPhotoIdInput, SupportPhotoIdOutput>`
- `descriptor.status = 'ACTIVE'` once implemented, `'NOT_IMPLEMENTED'` until ready

Register in `src/intelligence/registry.ts` by adding one import and one `REGISTRY` entry (both additive).

### Deletion Job: Cron Route

**File to create:** `src/app/api/cron/support-photo-cleanup/route.ts`

Add to `vercel.json` crons array. Auth pattern: copy lines 309–313 from `src/app/api/cron/daily-digest/route.ts`.

### Device Photo Queue

**Do not extend `offline-queue.ts`.** See Section 9 for rationale.

**File to create:** `src/lib/support-photo-queue.ts`

New `IDBPDatabase` schema with a separate object store (`support_photo_queue`) inside a new or upgraded `pipefield-offline` DB. Companion hook: `src/hooks/useSupportPhotoSync.ts`. This is additive (new object store = additive schema change, see Section 9).

### Upload UI: Camera Control

**File:** `src/components/pipe-support/SupportCalculator.tsx`

Insert the camera capture UI as a new section after line 128 (after the `</>` of the `result` branch), before `<SaveCalculationModal>` at line 131. This is an additive JSX block inside the existing component — no existing JSX removed or modified.

---

## 9. Non-Additive Risks

### Risk 1: `pipe-reference/page.tsx` — Support Visual Grid Tab

The `/pipe-reference` page (`src/app/(dashboard)/pipe-reference/page.tsx`) uses a `Tab` union type (`type Tab = 'dims' | 'fittings' | 'flanges' | 'valves' | 'spans'` at line 29) and a `TABS` constant array (lines 32–38). Adding a "Support Types" tab requires:
- Adding `'support-types'` to the `Tab` union — **additive** (extending a union)
- Adding an entry to the `TABS` array — **additive** (appending to array)
- Adding a new `{tab === 'support-types' && (...)}` block — **additive** (new conditional block)

**Verdict: additive. No modification of existing tab rendering logic required.**

### Risk 2: `offline-queue.ts` — IndexedDB Schema Version

`src/lib/offline-queue.ts` line 26: `openDB<PipeFieldDB>('pipefield-offline', 1, { upgrade(db) { ... } })`. The database is at version 1 with a single store `weld_queue`.

**Non-additive risk:** If `support_photo_queue` is added to the same DB object store schema, the version must be bumped to `2` and an `upgrade()` handler must handle both v1→v2 migration and fresh installs. The existing `WeldQueueItem` schema and `weld_queue` store must not be modified.

**Additive alternative (recommended):** Create a separate IndexedDB database:
```ts
// src/lib/support-photo-queue.ts
openDB<SupportPhotoDB>('pipefield-support-photos', 1, {
  upgrade(db) {
    const store = db.createObjectStore('support_photo_queue', { keyPath: 'local_id' })
    store.createIndex('by-sync-status', 'sync_status')
  },
})
```
This is a **completely separate IndexedDB instance** — no version bump to `pipefield-offline`, no risk to existing weld queue data, no migration required.

### Risk 3: `SupportCalculator.tsx` — Modification vs. Addition

`src/components/pipe-support/SupportCalculator.tsx` is a single component. Adding a camera upload section requires inserting JSX. The insertion is additive (new `<div>` block), but the file itself must be edited. This is not a structural non-additive change — no existing state, props, or logic needs to change.

### Risk 4: `src/intelligence/registry.ts` — REGISTRY and CapabilityName

Two additive changes required:
1. `src/intelligence/types.ts`: add `'support-photo-id'` to `CapabilityName` union
2. `src/intelligence/registry.ts`: add import + REGISTRY entry

These are additive (extending a union, adding a map entry). The `invoke()` function signature and all existing adapters are unchanged.

### Risk 5: `vercel.json` Cron Limit

Current: 2 cron jobs. Vercel Hobby plan limits to 2 cron jobs. Adding the 7-day cleanup cron requires either:
- **Upgrade to Vercel Pro** (recommended), or
- **Piggyback on `daily-digest`** — add cleanup logic inside the existing `daily-digest` route as a second pass (additive code within the route). Less clean but avoids plan upgrade.

---

## BLOCKERS

| # | Blocker | Non-Additive Risk | Proposed Additive Alternative |
|---|---------|-------------------|-------------------------------|
| B1 | `offline-queue.ts` IndexedDB version bump | Bumping `pipefield-offline` DB from v1→v2 risks weld queue corruption if upgrade handler is incorrect | Create a separate `pipefield-support-photos` IndexedDB (new file `src/lib/support-photo-queue.ts`) — zero overlap with existing queue |
| B2 | `CapabilityName` union extension | Adding `'support-photo-id'` is additive, but TypeScript will type-error at any `switch` that doesn't handle the new case | Grep for `switch (capability)` before shipping — there are none in the current codebase (registry uses a Map, not a switch) |
| B3 | Vercel cron slot limit | Hobby plan allows 2 cron jobs; adding a third requires plan change | Embed cleanup logic inside existing `daily-digest` route (additive function call, no new cron entry needed as a fallback) |
| B4 | No `pipe_support_catalog` table | Cannot ship support type AI identification without a schema for storing catalog entries | Additive migration `supabase/migrations/20260715_pipe_support_catalog.sql` (proposed in Section 6) |
| B5 | No EXIF stripping | Support photos from mobile devices will carry GPS metadata | Add `sharp` to dependencies; strip EXIF in `POST /api/v1/supports/identify` before storing (additive — new dependency, new code path) |
| B6 | `vercel.json` `Permissions-Policy` blocks camera | Line `"camera=()"` in `vercel.json` headers (line 23) blocks browser camera API globally | Change `camera=()` to `camera=(self)` — **this is a modification of `vercel.json`**, not additive. Required for web camera capture. Native Capacitor camera bypasses this header entirely and is unaffected. |

### B6 Detail — Camera Permissions Policy

`vercel.json` lines 21–24:
```json
{ "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
```

`camera=()` disables the browser `getUserMedia` / `MediaDevices.getUserMedia` camera API on all pages. If Phase 1 uses a `<input type="file" accept="image/*" capture="environment">` HTML element (file picker + camera, no JS camera API), this header does **not** block it — file input camera capture is not governed by Permissions-Policy. If Phase 1 uses `navigator.mediaDevices.getUserMedia()` for a live viewfinder, the header must be changed to `camera=(self)`.

**Recommendation:** Use `<input type="file" accept="image/*" capture="environment">` in Phase 1 to avoid modifying `vercel.json`. This is fully additive and works on mobile browsers and Capacitor.

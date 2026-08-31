# PHASE_0_FINDINGS.md
# PipeField OS — Field Mode Module Pre-Work Analysis
# Date: 2026-08-26

---

## 2.1 Stack and Structure

### Framework, Router, Rendering Model, State Management

- **Framework:** Next.js 14.2.29 (`package.json:47`) using the App Router.
- **Router:** App Router with route groups: `(auth)`, `(dashboard)`, `(admin)`. Middleware at `src/middleware.ts` handles session refresh on every non-static request.
- **Rendering model:** Mixed. Server Components for data-fetch pages (weld detail, spool detail, project detail use `createAdminClient` + `getCallerProfile` server-side). Client Components (`'use client'`) for interactive UI. Quote from `src/app/(dashboard)/welds/[id]/page.tsx:1–10`: "Weld Detail — Server Component."
- **State management:** TanStack React Query (`@tanstack/react-query` 5.101.0) for server state — 333 import sites across `src/`. No Zustand or Redux found. Provider at `src/providers/QueryProvider.tsx`.
- **Mobile:** Capacitor 8.x (`capacitor.config.ts`) targeting iOS and Android. PWA via `@ducanh2912/next-pwa` 10.2.9.

### Database Client and Query Layer; Tenant Scoping

- **Database client:** Supabase (`@supabase/supabase-js` ^2.110.0, `@supabase/ssr` ^0.12.0).
- **Three client variants:**
  - `src/lib/supabase/server.ts` — anon key, cookie-based SSR sessions.
  - `src/lib/supabase/client.ts` — anon key, browser-side.
  - `src/lib/supabase/admin.ts` — service role key, bypasses RLS. Server-only.
- **Tenant scoping pattern — `getCallerProfile`:** Canonical implementation at `src/lib/api-auth.ts:29`. It authenticates via Bearer token (Strategy 1) or SSR cookie (Strategy 2), then queries `user_profiles` using `createAdminClient` to resolve `organization_id`, `role`, `id`. All route handlers call `requireAuth(req)` or `requireOrgAdmin(req)` (defined at `src/lib/api-auth.ts:82–116`) before touching data. Server-Component pages call `getCallerProfile()` directly and then apply `organization_id` as an explicit `.eq('organization_id', organizationId)` filter even when using `createAdminClient` (see `src/app/(dashboard)/welds/[id]/page.tsx:20–40`). RLS on Supabase enforces the same boundary for anon-key queries via `get_my_org_id()` / `get_my_role()` helper functions defined in `supabase/schema.sql:201–215`.

### Where Migrations Live and How They Are Applied

- **Location:** `supabase/migrations/` — dated SQL files (20260702 through 20260815). Also unnumbered fix/setup scripts directly in `supabase/` (e.g., `schema.sql`, `setup-all.sql`, `fix-all-columns.sql`).
- **Application:** No Supabase CLI `config.toml` found. Migrations appear to be applied manually via the Supabase Dashboard SQL editor or via `supabase/apply-missing-migrations.sql`. There is also an Alembic-based Python backend at `pipefield_os/migrations/` for the FastAPI service.
- **Note for Field Mode:** A new Field Mode migration should follow the dated naming convention: `20260826_field_mode_*.sql`.

### Feature-Flag Mechanism

**Confirmed present. Two-layer system:**

1. **Process-env flags** at `src/intelligence/flags.ts:1–74`. All flags are `const FLAGS = { FLAG_NAME: process.env.FLAG_NAME === 'true' }`. Evaluated at request time, not build time.
2. **Per-tenant DB overrides** at `supabase/migrations/20260815_org_feature_flags.sql`. Table `org_feature_flags (org_id, flag_name, enabled, metadata)` unique on `(org_id, flag_name)`. Resolution order: DB row > env var > false. API at `src/app/api/org/flags/route.ts`.

Current flags include: `PFOS_OFFLINE_FIELD` (Module 5A), `PFOS_MATERIAL_TRACE`, `PFOS_QUAL_ENFORCEMENT`, `PFOS_NDE_ENGINE`. A `PFOS_FIELD_MODE` flag does not yet exist — it must be added.

### Existing i18n Setup

**Status: SCAFFOLDED but not activated.** `next-intl` is NOT installed (absent from `package.json`).

- Locale list defined at `src/i18n/request.ts:10`: `['en-US', 'en-CA', 'en-GB', 'en-AU', 'fr-CA', 'fr-FR', 'de-DE', 'pt-BR', 'es-MX', 'ar-SA', 'zh-CN']`.
- Message files exist for three locales only: `messages/en-US.json`, `messages/en-GB.json`, `messages/fr-CA.json`.
- `src/i18n/README.md`: "Status: SCAFFOLDED — needs `next-intl` installed to activate." Activation checklist not complete.
- Unit conversion (`src/lib/units.ts`) is active and has no `next-intl` dependency.

### Unit System: SI-Internal or Planned?

**Storage is imperial. Display conversion is implemented and live.** `src/lib/units.ts:3–4`:

> "All internal storage is imperial (inches, feet, psi, lb, °F). These helpers convert to SI for display when `project.unit_system === 'si'`."

Conversion utilities confirmed live at `src/lib/units.ts`:
- `inToMm`, `mmToIn`, `ftToM`, `mToFt` (lines 18–23)
- `lbToKg`, `lbftToKgm` (lines 26–27)
- `psiToBar`, `psiToKpa`, `psiToMpa`, `barToPsi` (lines 30–33)
- `fToC`, `cToF` (lines 36–37)
- `NPS_TO_DN` lookup table (lines 40–55)
- `formatLength`, `formatSpan`, `formatPressure`, `formatTemp`, `formatWeight` (lines 59–90)

`projects.unit_system` column (`CHECK (unit_system IN ('imperial', 'si', 'mixed'))`) added in `supabase/migrations/20260815_project_standards_config.sql:23`.

---

## 2.2 Existing Assets to Reuse

### NPS 1–48 Pipe Dimension Dataset

**Not a database table — stored as JSON and in-code lookup tables.**

- `src/data/asme_pipe_dimensions.json` — keyed object `{ "B36.10M": { "<NPS>": { "OD_in": number, "schedules": { "<SCH>": { "wall_in": number, "ID_in": number } } } }, "B36.19M": {...} }`. B36.10M has 33 NPS sizes (0.5–60); B36.19M has 13 sizes (0.5–12). **No circumference column. No weight-per-length column.**
- `src/config/pipe-data.ts` — `PIPE_OD_TABLE` (NPS → OD in inches, 35 NPS sizes 0.5–48, `pipe-data.ts:114`), `PIPE_WALL_TABLE` (NPS → schedule → wall_in, `pipe-data.ts:158`), `NPS_SIZES` array (35 entries, `pipe-data.ts:73`). **No circumference. No weight-per-length.**

Circumference and weight-per-length must be computed (circumference = π × OD; weight per ASME B36.10M formula) or added as new columns.

### Pipe Support Reference UI

- **Pipe Support Calculator page:** `src/app/(dashboard)/pipe-support/page.tsx`
- **Components directory:** `src/components/pipe-support/` contains:
  - `SupportCalculator.tsx`, `InputForm.tsx`, `OutputScreen.tsx`, `PdfTriggerButton.tsx`, `SaveCalculationModal.tsx`
  - `SupportSpecTable.tsx` — filterable 3-row spec table (hardcoded sample data, `SupportSpecTable.tsx:3–23`)
  - `SupportPhotoIdentifier.tsx` — AI photo-ID widget
- **Pipe Reference page:** `src/app/(dashboard)/pipe-reference/page.tsx` — multi-tab reference library (Pipe Dims, Fitting Take-Outs B16.9, Flanges B16.5, Valves B16.10, Support Spans MSS SP-69). Imports from `src/config/pipe-data.ts` and `src/config/reference-data.ts`.
- **Reusability:** The pipe-reference multi-tab pattern is a good reference-page template. `SupportSpecTable` is a reusable filterable table. The `SupportPhotoIdentifier` is the AI photo-ID widget.

### Offline Entry Queue

- **Storage:** IndexedDB, database name `'pipefield-offline'`, version 2. `src/lib/offline-queue.ts`.
- **Entity types supported:** `weld`, `daily_report`, `spool` — three fixed object stores. **Not arbitrary entity types.** (`src/lib/offline-queue.ts:32`)
- **Retry handling:** `attempt_count` field incremented on each `markFailed()` call (`src/lib/offline-queue.ts:226–232`). No automatic back-off or max-attempt cap. No conflict-resolution strategy.
- **Status surface:** `pending | synced | failed`. Exported helpers: `getPendingWelds()`, `getPendingDailyReports()`, `getPendingSpools()`, `getPendingCount()`, `getAllQueueItems()`, `clearSynced()`, `purgeExpired()`.
- **TTL:** 30 days (`src/lib/offline-queue.ts:19`).

### Photo-ID Offline Queue (7-Day Retention)

- **Storage:** IndexedDB, database name `'pipefield-support-photos'`. `src/lib/support-photo-queue.ts`.
- **TTL:** 7 days (`src/lib/support-photo-queue.ts:5`).
- **Retention job:** `purgeExpiredPhotos()` marks expired items; `cleanupQueue()` physically deletes synced/expired items (`src/lib/support-photo-queue.ts:96–117`). Server-side cron cleanup at `src/app/api/cron/support-photo-cleanup/route.ts`.
- **Limits:** Max 25 pending items, max 100 MB total (`src/lib/support-photo-queue.ts:3–4`).

### Jurisdiction / Code-Edition Rule Engine

**There is no rule engine.** Jurisdiction and governing code are stored as project metadata columns only (`supabase/migrations/20260815_project_standards_config.sql:20–31`):
- `projects.jurisdiction` (ISO 3166-2, e.g., `'US-TX'`)
- `projects.governing_code` (free text)
- `projects.governing_code_year` (integer)
- `projects.ahj` (Authority Having Jurisdiction, free text)

No engine enforces or interprets rules based on jurisdiction or code edition. The qualification engine (`src/intelligence/engines/qualification-engine.ts`) enforces welder continuity but is not jurisdiction-parameterized.

### Existing Table Schemas — Column Level

**`welds`** (base: `supabase/schema.sql:102–121`; extended: `supabase/setup-all.sql:8–13`; WPS FK: `supabase/migrations/20260702_wps.sql:26`):
- `id uuid PK`, `organization_id uuid FK`, `project_id uuid FK`, `spool_id uuid FK nullable`
- `weld_id_number text` (e.g., "W-0001"), `welder_stamp text`, `welder_name text`
- `status text CHECK ('draft','fit_up_approved','welded','visual_pass','xray_pending','failed','repaired','accepted')`
- `weld_date date`, `notes text`, `created_by uuid FK`, `created_at timestamptz`, `updated_at timestamptz`
- Extended: `spool_number text`, `line_number text`, `pipe_size text`, `wall_thickness text`, `weld_process text`
- `wps_id uuid FK` (references `wps_records`)
- Material trace: `base_metal_heat_a text`, `base_metal_heat_b text`, `filler_batch_number text`

**`spools`** (base: `supabase/schema.sql:76–96`; extended: `supabase/setup-all.sql:15–32`):
- `id uuid PK`, `organization_id uuid FK`, `project_id uuid FK`
- `spool_number text`, `drawing_number text`, `area text`, `line_number text`, `assigned_crew text`
- `status text CHECK ('designed','material_released','cut','fit_up','welded','nde','painted','released')`
- Extended: `revision text`, `pipe_size text`, `pipe_schedule text`, `material text`, `service text`
- `design_pressure numeric(10,2)`, `design_temp numeric(8,2)`, `total_welds integer`, `total_length_in numeric(10,3)`
- `isometric_ref text`, `priority integer`, `required_date date`, `released_date date`

**`spool_items`** (`supabase/setup-all.sql:40–54`):
- `id uuid PK`, `spool_id uuid FK`, `organization_id uuid FK`
- `item_number integer`, `item_type text DEFAULT 'other'`, `description text`, `quantity integer`
- `length_in numeric(10,3)`, `heat_number text`, `is_cut boolean`, `is_fitted boolean`
- `notes text`, `created_at timestamptz`

**`weld_photos`** (`supabase/migrations/20260702_weld_photos.sql`):
- `id uuid PK`, `organization_id uuid FK`, `weld_id uuid FK`
- `storage_path text`, `file_name text`, `file_size integer`
- `uploaded_by uuid FK (auth.users)`, `caption text`, `created_at timestamptz`

**`audit_logs`** (`supabase/schema.sql:127–137`):
- `id uuid PK`, `organization_id uuid FK`, `table_name text`, `record_id uuid`
- `action text CHECK ('INSERT','UPDATE','DELETE')`
- `previous_values jsonb`, `new_values jsonb`
- `performed_by uuid FK (user_profiles)`, `performed_at timestamptz`

### Auth Session Lifetime and Re-auth Policy

- **Token lifetime:** Supabase default 1-hour JWT access token. `src/middleware.ts:7–12`: "The access token expires after 1 hour, and without middleware refreshing it... every API call fails permanently until the user manually signs out/in."
- **Refresh mechanism:** `supabase.auth.getUser()` called on every non-static request in `src/middleware.ts:55–57`.
- **Re-auth policy:** No explicit re-authentication challenge found anywhere in the codebase. No `reauthenticate()` call sites.

---

## 2.3 Roles

### Current Role Model

Full role list from `src/types/index.ts:9–17` and enforced in `user_profiles.role CHECK` (`supabase/schema.sql:39–42`):

```
platform_admin       — cross-tenant superadmin; can access /admin; can bypass org scoping
organization_owner   — per-tenant owner; can manage org, invite, set flags
administrator        — per-tenant admin
project_manager
foreman
qa_inspector         — QA/QC Inspector
shop_fabricator
pipefitter           — default role on registration
client_viewer        — read-only client access
```

### Is There a Fitter/Welder Role Distinct from Foreman/QC/Admin?

**There is a `pipefitter` role** (`src/types/index.ts:17`). There is **no separate `welder` role**. Welders are tracked in a separate `welders` table (with `stamp`, `cert_expiry`, `process` columns) and linked to welds by `welder_stamp`. A `pipefitter` user can have a `welder_stamp` on their `user_profiles` record (`supabase/schema.sql:45`). The `shop_fabricator` role is closest to a field fabricator. `foreman` is distinct from `qa_inspector`.

### Is There an Owner/Superadmin Role with Cross-Tenant Permissions?

**Yes — `platform_admin`.** Confirmed at `src/lib/api-auth.ts:12–14`:
```typescript
export const ORG_ADMIN_ROLES = [
  'platform_admin',
  'organization_owner',
  'administrator',
] as const
```
`platform_admin` bypasses org-scoping:
- `src/app/api/organization/workers/route.ts:88–89`: `if (caller.role !== 'platform_admin') { // Verify target worker is in the same org }`
- `supabase/migrations/20260710_pc1_rls_helpers.sql:10–12`: `CREATE OR REPLACE FUNCTION public.is_platform_admin() ... SELECT public.get_my_role() = 'platform_admin'`
- `src/app/(admin)/layout.tsx:20` checks for `platform_admin` via `getCallerProfile()`.

`platform_admin` is assigned only via `/api/admin/users` which itself requires `platform_admin` access (`src/app/api/admin/users/route.ts:15`).

---

## 2.4 Inventory the Recall Data

### `/data/sources/recall/` Directory

**This directory does not exist in the codebase.** A full recursive search (`find /Users/rennerkargbo/Desktop/pipefield-os -name "recall*" -not -path "*/node_modules/*"`) returned zero results. There are no CSV files anywhere in the project outside of `node_modules`.

- No `/data/sources/recall/` path exists.
- No recall CSV files exist.
- No `source_doc`, `verified`, `verified_by`, `verified_against`, or `recall_confidence` columns exist anywhere in the schema.
- No VALIDATION_REPORT_batch*.md files exist.
- No "check these first" items can be listed because the source material does not exist.

The recall capability is implemented as a SQL function `batch_recall()` in `supabase/migrations/20260710_module3_material_trace.sql:28–79` that queries live `welds` rows by heat number or filler batch against the tenant's production data — not from imported CSV seed data.

---

## 2.5 Risks

### New Route Groups

Adding a new route group (e.g., `(field)`) is low risk in Next.js App Router. Route groups do not affect URL paths. **Risk:** The service worker at `public/sw.js` is a compiled Workbox precache manifest with a hard-coded chunk URL list. Adding new routes triggers a new build which regenerates `sw.js` automatically — no manual SW change needed. The SW scope is `/` root, so any sub-path is within scope.

### New Tables

Adding new tables requires a new migration SQL file. **Risk:** The `supabase/migrations/` directory contains both dated files and ad-hoc scripts applied outside the numbered migration sequence. There is no Supabase CLI lock file (`config.toml` not found). New migrations must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). **Critical:** RLS must be explicitly enabled on every new table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) or data is globally readable by all authenticated users. Several existing tables show this pattern being applied retroactively (see `supabase/migrations/20260805_enable_rls_core_tables.sql`).

### New Service Worker Scope

The service worker is registered at `/` scope (no explicit scope override in `next.config.mjs`). A new `/field/...` route is automatically within scope. **Risk:** The Workbox `NetworkFirst` cache for Supabase API URLs caches GET responses for 24 hours (`next.config.mjs`, workboxOptions runtimeCaching). If Field Mode endpoints return large per-user datasets, stale cached responses could surface wrong data after a session switch. This is a pre-existing risk that Field Mode's offline-first pattern will make more visible.

### Bundle Size

- Current `.next/static/chunks/` total: **4.1 MB across 67 JS chunks**; largest single chunk 344 KB.
- ~1,300 reference rows as inline JSON: a typical pipe dimension row is ~200–400 bytes. 1,300 rows ≈ 260–520 KB raw. Bundled and gzip-compressed this is likely 40–80 KB. **Manageable.** However, if the data is imported into a client component without `import()` dynamic splitting, it inflates the initial bundle for every dashboard page. Recommendation: lazy-load via `import()` or a dedicated API route.

---

## 2.6 Adversarial Self-Check

### "I assumed a flag system exists and it doesn't."

**False — confirmed present.** Two-layer flag system at `src/intelligence/flags.ts` (process-env) and `org_feature_flags` table (per-tenant DB overrides). However, no `PFOS_FIELD_MODE` flag exists yet — it must be added.

### "I assumed the offline queue handles arbitrary entity types, but it only handles welds."

**Corrected.** The offline queue (`src/lib/offline-queue.ts`) handles three fixed entity types: `weld`, `daily_report`, `spool`. The `EntityType` type is `'weld' | 'daily_report' | 'spool'` (`src/lib/offline-queue.ts:32`). A Field Mode entity type would require a new IndexedDB object store, union type extension, and new CRUD helpers. The queue is not plug-and-play for new types.

### "I assumed SI-internal is live, but the schema stores inches."

**Confirmed: schema stores imperial.** `src/lib/units.ts:3`: "All internal storage is imperial (inches, feet, psi, lb, °F)." Conversion to SI for display is live via the `formatLength`, `formatPressure`, etc. helpers. Field Mode data entry must store in imperial and display per `project.unit_system`.

### "The service-role client is still reachable from a page a fitter could hit." List every remaining `createAdminClient` call site.

**Pre-existing risk.** Four dashboard/public page routes use `createAdminClient` directly, accessible to any authenticated user (or unauthenticated, for share):

1. `src/app/(dashboard)/projects/[id]/page.tsx:29` — Server Component; tenant-scoped by `eq('organization_id', organizationId)` after `getCallerProfile()`.
2. `src/app/(dashboard)/spools/[id]/page.tsx:26` — same pattern.
3. `src/app/(dashboard)/welds/[id]/page.tsx:21` — same pattern.
4. `src/app/share/[token]/page.tsx:18,140` — public share page; no auth required to reach this route.

In all three dashboard cases, org-scoping is enforced manually via `.eq('organization_id', ...)`. The risk is a missing `.eq` clause creating a cross-tenant data leak. This is a pre-existing architectural risk; Field Mode page routes must follow the same pattern.

All 105 source files that import `createAdminClient` are listed (excluding `src/lib/supabase/admin.ts` which defines it):
- **Dashboard page routes (fitter-accessible):** `src/app/(dashboard)/projects/[id]/page.tsx`, `src/app/(dashboard)/spools/[id]/page.tsx`, `src/app/(dashboard)/welds/[id]/page.tsx`, `src/app/share/[token]/page.tsx`
- **API routes** (require auth via `requireAuth`/`requireOrgAdmin`): all files under `src/app/api/**` (~85 files)
- **Intelligence adapters** (server-only, called from API routes): `src/intelligence/accounting.ts`, `src/intelligence/audit.ts`, `src/intelligence/registry.ts`, `src/intelligence/tier.ts`, all `src/intelligence/adapters/*.ts` (14 files), `src/intelligence/engines/nde-selection-engine.ts`, `src/intelligence/engines/qualification-engine.ts`
- **Library utilities** (server-only): `src/lib/api-auth.ts`, `src/lib/api-billing-guard.ts`, `src/lib/ai-rate-limit.ts`, `src/lib/notifications.ts`, `src/lib/spool-auto-release.ts`, `src/lib/usage.ts`, `src/lib/weld-events.ts`

### "There is no owner-level role, so reference verification would have to be per-tenant, which is wrong."

**False — `platform_admin` is a confirmed cross-tenant role.** `src/lib/api-auth.ts:12–14`, `src/types/index.ts:10`, `src/app/api/admin/users/route.ts:15`. A `platform_admin` can read and write across all tenants. Reference data verification for Field Mode reference tables can be seeded or managed by `platform_admin`. Per-tenant reference customization (e.g., `pipe_support_catalog`) is gated by `organization_owner` and `administrator` within each tenant.

---

## Summary of Items Missing for Field Mode

| Item | Status |
|---|---|
| `PFOS_FIELD_MODE` feature flag | Missing — must be added to `src/intelligence/flags.ts` and `FEATURE_FLAGS.md` |
| `/data/sources/recall/` recall CSV dataset | Does not exist — must be created if Field Mode requires static recall reference data |
| `welder` role | Does not exist — only `pipefitter`; Field Mode role mapping must use `pipefitter` and/or `shop_fabricator` |
| Offline queue for new entity types | Not plug-and-play — new types require explicit object store, type union, and CRUD helpers |
| Circumference / weight-per-length in pipe dimension data | Not present — must be computed or added to `pipe-data.ts` / `asme_pipe_dimensions.json` |
| i18n activation | `next-intl` not installed; Field Mode strings will be hardcoded like all other UI |
| Jurisdiction/code rule engine | Does not exist — only metadata storage; runtime enforcement requires building an engine |

---

Phase 0 complete. Awaiting `APPROVED: PHASE 0`.

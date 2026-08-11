# SECURITY AUDIT FINDINGS
## Phase 0 — Admin-Client Removal: Read-Only Analysis
**Date:** 2026-08-05  
**Scope:** `/Users/rennerkargbo/Desktop/pipefield-os/src`  
**Auditor:** Claude (automated, read-only)

---

## 1. Confirmed Facts

### Step 1 — Patch Under Review

`git status` shows **exactly three** uncommitted modified files:

```
modified: src/app/(dashboard)/projects/[id]/page.tsx
modified: src/app/(dashboard)/spools/[id]/page.tsx
modified: src/app/(dashboard)/welds/[id]/page.tsx
```

The three detail pages are:
- **ProjectDetailPage** — `src/app/(dashboard)/projects/[id]/page.tsx`
- **SpoolDetailPage** — `src/app/(dashboard)/spools/[id]/page.tsx`
- **WeldDetailPage** — `src/app/(dashboard)/welds/[id]/page.tsx`

The three detail client components they render are:
- **ProjectDetailClient** — `src/components/projects/ProjectDetailClient.tsx`
- **SpoolDetailClient** — `src/components/spools/SpoolDetailClient.tsx`
- **WeldDetailClient** — `src/components/welds/WeldDetailClient.tsx`

---

### Investigation Item 2.1 — `createAdminClient` Uses the Service-Role Key (CONFIRMED)

**File:** `src/lib/supabase/admin.ts`, lines 9–23

```ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // ...
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

The key is `SUPABASE_SERVICE_ROLE_KEY`. The file's own header comment states explicitly: *"Uses the service role key — bypasses ALL Row Level Security."* The Supabase service-role key maps to the PostgreSQL `service_role` role. Supabase's documentation and implementation confirm that `service_role` has `BYPASSRLS` privilege — RLS policies are not evaluated for queries made with this key. **The prior analysis was wrong: RLS is NOT a second enforcement layer when `createAdminClient` is used.**

---

### Investigation Item 2.1 — Trust Chain for `getCallerProfile` (CONFIRMED)

**File:** `src/lib/api-auth.ts`, lines 29–81

The full chain:

1. **Strategy 1 (Bearer token):** If `Authorization: Bearer <token>` header is present, line 43:
   ```ts
   const { data: { user }, error } = await admin.auth.getUser(token)
   ```
   This calls `auth.getUser()` — **server-verified JWT** (Supabase verifies the JWT signature server-side). `CONFIRMED`.

2. **Strategy 2 (Cookie):** If no Bearer token, lines 48–65:
   ```ts
   const { data: { user } } = await supabase.auth.getUser()
   ```
   Uses `createServerClient` with the **anon key**, calling `getUser()` — also server-verified. `CONFIRMED`.

3. **Profile lookup**, lines 67–73:
   ```ts
   const { data: profile } = await admin
     .from('user_profiles')
     .select('id, auth_user_id, role, organization_id, full_name, status')
     .eq('auth_user_id', userId)
     .maybeSingle()
   return profile ?? null
   ```
   `organization_id` is read from the **database row** keyed on the verified `auth.uid()`. It is **not** from a JWT claim.

**Input influence analysis:**
- `Authorization` header → **influences** `userId` via Bearer token path
- Session cookie → **influences** `userId` via cookie path  
- Query parameters → **does not influence** `organization_id`
- Request body fields → **does not influence** `organization_id`
- Route params → **does not influence** `organization_id`

**Edge cases:**
- Unauthenticated request: both strategies return no user → function returns `null` (line 75)
- Authenticated user with no profile row: `.maybeSingle()` returns null → `profile ?? null` returns `null` (line 74)
- Profile with `organization_id IS NULL`: function returns the profile with `organization_id: null` — **caller receives a non-null CallerProfile with a null organization_id** — this is a latent bug (see Findings)
- User belonging to more than one organization: the query has no multi-org support; `LIMIT 1` is implicit via `.maybeSingle()` — returns whichever row Postgres returns first. `UNVERIFIABLE-WITHOUT-DB-ACCESS` whether any user_profiles rows have duplicate auth_user_id entries.

---

### Investigation Item 2.2 — Why Is `createAdminClient` Still Present? (CONFIRMED)

**All three pages** use `createAdminClient` for the SSR initial data fetch. The diff shows no attempt to remove it — only tenant-scoping filters were added.

**H1 — `audit_logs` blocked for authenticated roles:** `CONFIRMED PARTIAL`. Migration `supabase/004_rls_admin.sql` defines only a SELECT policy for `audit_logs`:
```sql
CREATE POLICY "audit_logs_select"
  ON public.audit_logs FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
```
There is **no INSERT policy** for `audit_logs` in any migration file. If RLS is enabled on `audit_logs`, authenticated users cannot write to it — INSERT is blocked. Whether RLS is actually **enabled** on `audit_logs` is `UNVERIFIABLE-WITHOUT-DB-ACCESS` from migrations alone (no `ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY` was found in any migration file).

**H2 — Joins reach tables without RLS policies:** `CONFIRMED` for `fetchSpool`. The `fetchSpool` function (`src/hooks/useSpools.ts`, line 22) and `SpoolDetailPage` fetch `.select('*, projects(name), spool_items(*)')`. The `projects` join is read via the `projects` policy. However, `spool_items` has RLS enabled and policies (`setup-all.sql` line 56; `fix-spool-creation.sql`), so H2 does not apply to spool_items specifically. H2 is `NOT CONFIRMED` as the primary driver.

**H3 — Storage operations require admin client:** `INFERRED NOT`. WeldDetailPage does not perform storage operations server-side — photos are fetched from the `weld_photos` table, not via signed URLs from the admin client.

**H4 — Vestigial pattern:** `CONFIRMED`. The original comment on each page says *"Uses admin client so server render never fails due to cookie issues."* The patch itself confirms this — the admin client was adopted as a defensive pattern, not because RLS-scoped access was insufficient for these reads.

---

### Investigation Item 2.3 — Per-Page, Per-Operation Replaceability (CONFIRMED)

| Page | Operation | Verdict |
|------|-----------|---------|
| ProjectDetailPage | SELECT from `projects` by id + org | `REPLACEABLE ONLY AFTER RLS VERIFIED ENABLED` |
| SpoolDetailPage | SELECT from `spools` + `projects(name)` + `spool_items(*)` | `REPLACEABLE ONLY AFTER RLS VERIFIED ENABLED` |
| WeldDetailPage | SELECT from `welds` | `REPLACEABLE ONLY AFTER RLS VERIFIED ENABLED` |
| WeldDetailPage | SELECT from `weld_photos` | `REPLACEABLE ONLY AFTER RLS VERIFIED ENABLED` |
| WeldDetailPage | SELECT from `audit_logs` | `REPLACEABLE ONLY AFTER INSERT POLICY ADDED AND RLS ENABLED` |

---

### Investigation Item 2.4 — RLS Policy Inspection (CONFIRMED from migrations / UNVERIFIABLE-WITHOUT-DB-ACCESS for live state)

**RLS Enablement (from migration files):**

| Table | `ENABLE ROW LEVEL SECURITY` found in migrations? | `FORCE ROW LEVEL SECURITY` found? |
|-------|--------------------------------------------------|-----------------------------------|
| `projects` | **NOT FOUND** | NOT FOUND |
| `spools` | FOUND (`fix-spool-creation.sql:L1`, `fix-spools-schema.sql`, `spools.sql:L86`) | NOT FOUND |
| `spool_items` | FOUND (`setup-all.sql:L56`, `fix-spool-creation.sql`, `fix-spools-schema.sql`, `spools.sql:L87`) | NOT FOUND |
| `welds` | **NOT FOUND** | NOT FOUND |
| `weld_photos` | FOUND (`005_nde_photos.sql:L67`) | NOT FOUND |
| `audit_logs` | **NOT FOUND** | NOT FOUND |

**CRITICAL FINDING:** `projects`, `welds`, and `audit_logs` have no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in any migration file. Policies are defined for them in `004_rls_admin.sql` and `fix-rls.sql`, but **a policy on a table with RLS disabled has zero enforcement**. Even if these tables were enabled in the live database through the Supabase dashboard or a missing migration, the repository is not the source of truth for this.

**Policies from migration files:**

`projects` (from `supabase/004_rls_admin.sql` and `supabase/fix-rls.sql`):
```sql
CREATE POLICY "projects_select" ON public.projects FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "projects_insert" ON public.projects FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "projects_delete" ON public.projects FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));
```

`spools` (from `supabase/004_rls_admin.sql`):
```sql
CREATE POLICY "spools_select" ON public.spools FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
-- insert/update/delete: same pattern
```

`spool_items` (from `supabase/setup-all.sql`):
```sql
CREATE POLICY "spool_items_select" ON public.spool_items FOR SELECT
  USING (organization_id = public.get_my_org_id());
-- insert/update/delete: same pattern
-- NOTE: uses get_my_org_id() not my_org_id() — different function name
```

`welds` (from `supabase/004_rls_admin.sql`):
```sql
CREATE POLICY "welds_select" ON public.welds FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
-- insert/update/delete: same pattern
```

`weld_photos` (from `supabase/005_nde_photos.sql`):
```sql
CREATE POLICY "weld_photos_select" ON public.weld_photos FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "weld_photos_insert" ON public.weld_photos FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "weld_photos_delete" ON public.weld_photos FOR DELETE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
-- NOTE: no UPDATE policy defined
```

`audit_logs` (from `supabase/004_rls_admin.sql`):
```sql
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
-- NOTE: no INSERT, UPDATE, or DELETE policy defined
```

**Storage Bucket `weld-photos`** (from `supabase/005_nde_photos.sql`, line 40):
```sql
INSERT INTO storage.buckets (id, name, public, ...)
VALUES ('weld-photos', 'weld-photos', true, ...)
```
**`public: true`** — the bucket is publicly readable without authentication. Storage policies:
```sql
CREATE POLICY "org_members_upload_weld_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'weld-photos');
CREATE POLICY "org_members_view_weld_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'weld-photos');
```
The VIEW policy allows **any authenticated user from any organization** to read any object in the bucket. Object paths are **not tenant-scoped** in the policy — `bucket_id = 'weld-photos'` is the only constraint. An authenticated user from Org A can directly fetch weld photo URLs belonging to Org B if they know or guess the storage path.

---

### Investigation Item 2.5 — Data Paths from the Three Detail Components

**WeldDetailClient** (`src/components/welds/WeldDetailClient.tsx`):
- Initial data: server-prefetched via `WeldDetailPage` → `fetchWeldServer()` → admin client (tenant-filtered in app code by patch, not by RLS)
- Client refetch: `useWeld(id)` → `fetchWeld(id)` (`src/hooks/useWelds.ts`, line 20):
  ```ts
  supabase.from('welds').select('*, projects(name), spools(spool_number)').eq('id', id).single()
  supabase.from('weld_photos').select('*').eq('weld_id', id)
  supabase.from('audit_logs').select('*, user_profiles(full_name)').eq('table_name','welds').eq('record_id', id)
  ```
  **No `.eq('organization_id', ...)` filter on any of these three queries.** Tenant isolation relies entirely on RLS. If RLS is disabled on `welds` or `audit_logs`, these queries leak cross-org data.
- Realtime: `src/hooks/useWelds.ts`, line 104:
  ```ts
  const channel = supabase.from('welds').on('*', ...).filter(`organization_id=eq.${organizationId}`, ...)
  ```
  Channel filter is tenant-scoped in app code. `CONFIRMED`.
- Mutations (weld status update): uses `createClient()` (RLS-scoped anon key) with `organization_id` set from profile.

**SpoolDetailClient** (`src/components/spools/SpoolDetailClient.tsx`):
- Initial data: server-prefetched via `SpoolDetailPage` → admin client (tenant-filtered by patch)
- Client refetch: `useSpool(id)` → `fetchSpool(id)` (`src/hooks/useSpools.ts`, line 18):
  ```ts
  supabase.from('spools').select('*, projects(name), spool_items(*)').eq('id', id).single()
  ```
  **No `.eq('organization_id', ...)` filter.** Relies entirely on RLS for `spools` and `spool_items`.

**ProjectDetailClient** (`src/components/projects/ProjectDetailClient.tsx`):
- Initial data: server-prefetched via `ProjectDetailPage` → admin client (tenant-filtered by patch)
- Client-side queries: use `useProjects` hook with `organization_id` filter in app code. `CONFIRMED`.

---

### Investigation Item 2.6 — `organization_id ?? ''` Pattern (CONFIRMED)

The patch introduces this pattern in all three pages. Examples:

`src/app/(dashboard)/projects/[id]/page.tsx`, line 33:
```ts
.eq('organization_id', caller.organization_id ?? '')
```

`src/app/(dashboard)/spools/[id]/page.tsx`, line 31:
```ts
.eq('organization_id', caller.organization_id ?? '')
```

`src/app/(dashboard)/welds/[id]/page.tsx`, line 57:
```ts
const initialData = await fetchWeldServer(params.id, caller.organization_id ?? '')
```
...which is used on lines 29, 34, 39 in the same file as:
```ts
.eq('organization_id', organizationId)
```

**The `?? ''` coercion is dangerous.** An empty string passed to `.eq('organization_id', '')` does not return zero rows from Supabase/PostgreSQL — it returns rows where `organization_id = ''`. Since `organization_id` is a UUID column, no rows match an empty string, so this silently returns empty results (fail-silent, not fail-closed). If a user has `organization_id IS NULL` in their profile, the query silently returns nothing rather than throwing an authorization error.

**No other `?? ''` patterns were found** in the three patched files beyond those cited above.

---

### Investigation Item 2.7 — Fail-Silent Risk

When RLS silently filters everything out, or when `organization_id ?? ''` produces no matches:

- **ProjectDetailPage**: `notFound()` is called if `!project` (line 36). A cross-org fetch returns `null` → renders Next.js 404 page. This is the correct UX, but the *reason* is indistinguishable from a genuine missing record.
- **SpoolDetailPage**: `.single()` throws if no row is returned → `catch` block calls `notFound()`. Same as above.
- **WeldDetailPage**: `fetchWeldServer` uses `.single()` for welds — error throws → `catch` block calls `notFound()`. Photos and audit_logs use non-throwing queries; if they return empty, the UI renders empty photo gallery and empty timeline. **No distinction between "no photos" and "authorization filtered all photos."**

**The fail-silent risk for client-side refetches is higher:** `fetchWeld`, `fetchSpool` have no `.eq('organization_id')` filter client-side — they rely on RLS. If RLS is disabled, a cross-tenant fetch succeeds silently and renders another org's data.

---

### Investigation Item 2.8 — Service-Role Key Exposure (CONFIRMED)

All files importing `createAdminClient`:
```
src/lib/api-auth.ts                                          — server-only (no 'use client')
src/app/api/*/route.ts  (all API routes)                    — server-only (route handlers)
src/app/(dashboard)/projects/[id]/page.tsx                   — Server Component (no 'use client')
src/app/(dashboard)/spools/[id]/page.tsx                     — Server Component (no 'use client')
src/app/(dashboard)/welds/[id]/page.tsx                      — Server Component (no 'use client')
```

No `createAdminClient` import was found in any file starting with `'use client'`. The `SUPABASE_SERVICE_ROLE_KEY` env var does not have the `NEXT_PUBLIC_` prefix, so Next.js does not include it in the browser bundle. `CONFIRMED` — the service-role key is not exposed to the client.

---

## 2. Unresolved Assumptions

**U-1:** Whether RLS is actually **enabled** on `projects`, `welds`, and `audit_logs` in the live Supabase database. No migration file contains `ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY` (or equivalent for `welds` / `audit_logs`). The tables may have been enabled manually via the Supabase dashboard. **This is the single most important unknown in the entire audit.** If these tables have RLS disabled in production, the patch provides zero tenant isolation for the server-side read and the client-side refetch relies on non-existent enforcement.  
*Resolves with:* `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('projects', 'welds', 'audit_logs');`

**U-2:** Whether `FORCE ROW LEVEL SECURITY` is set on any of the six tables. Without `FORCE RLS`, the table owner role (`postgres`) bypasses policies regardless — relevant if any path escalates to the owner role.  
*Resolves with:* `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('projects','spools','spool_items','welds','weld_photos','audit_logs');`

**U-3:** The live policy state for all six tables via `pg_policies`. Migration files may have been run out of order, partially, or superseded by dashboard edits.  
*Resolves with:* `SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('projects','spools','spool_items','welds','weld_photos','audit_logs');`

**U-4:** Whether any `user_profiles` rows exist with `organization_id IS NULL` in production. This determines whether the `?? ''` path is a theoretical or active risk.  
*Resolves with:* `SELECT COUNT(*) FROM user_profiles WHERE organization_id IS NULL;`

**U-5:** Whether `public.my_org_id()` and `public.get_my_org_id()` are the same function or two different functions with potentially different semantics. `spool_items` policies use `get_my_org_id()` while other tables use `my_org_id()`.  
*Resolves with:* `SELECT proname, prosrc FROM pg_proc WHERE proname IN ('my_org_id','get_my_org_id');`

---

## 3. Severity-Ranked Findings

### CRITICAL

**CRIT-1: `projects`, `welds`, and `audit_logs` may have RLS disabled (UNVERIFIABLE-WITHOUT-DB-ACCESS)**

No `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` exists in any migration for these three tables. Policies are defined but **a policy on a table with RLS disabled is not enforced**. If RLS is disabled:
- Any authenticated user can read any project, weld, or audit log across all organizations.
- The patch's `.eq('organization_id', ...)` filters on the server-side read provide the only isolation — and those can be bypassed client-side via `fetchWeld`/`fetchSpool` which have no org filter.
- **Exploit path:** Authenticated user from Org A navigates to `/welds/<uuid-belonging-to-org-B>`. Server returns 404 (patch filters it). Client calls `fetchWeld(id)` which has no org filter. If RLS is off on `welds`, the RLS-key client returns Org B's weld data. React Query renders it.

**CRIT-2: `weld-photos` storage bucket is public with no tenant scoping in policy (CONFIRMED)**

File: `supabase/005_nde_photos.sql`, line 40: `public: true`. Storage SELECT policy: `USING (bucket_id = 'weld-photos')` — any authenticated user from any org can read any weld photo.  
**Exploit path:** Org A user knows or guesses the storage path of an Org B weld photo (paths are not secret — they're stored in the `weld_photos` table which has RLS, but the actual object URL is public). Direct GET to the storage URL returns Org B's photo with no auth check.

**CRIT-3: `organization_id ?? ''` is fail-silent, not fail-closed (CONFIRMED)**

File: `src/app/(dashboard)/projects/[id]/page.tsx` line 33, `spools/[id]/page.tsx` line 31, `welds/[id]/page.tsx` line 57.  
A user with `organization_id IS NULL` passes auth (`getCallerProfile` returns non-null) but gets scoped to `organization_id = ''` — empty string against a UUID column. Result: empty-set returned (not an error), page renders 404. The correct behavior is an explicit 401/403 before any query is issued. Additionally, this pattern means the admin client is still making a query with a potentially meaningless filter instead of aborting.

**CRIT-4: `fetchWeld` and `fetchSpool` have no application-level org filter (CONFIRMED)**

Files: `src/hooks/useWelds.ts` lines 22–42; `src/hooks/useSpools.ts` lines 20–28.  
```ts
// fetchWeld — no organization_id filter:
supabase.from('welds').select('...').eq('id', id).single()
supabase.from('weld_photos').select('*').eq('weld_id', id)
supabase.from('audit_logs').select('...').eq('record_id', id)
```
These functions are called on every client-side refetch and React Query cache miss. Tenant isolation depends **entirely** on RLS. If RLS is disabled on `welds` or `audit_logs` (CRIT-1), cross-org data is served to the browser on every page visit.

---

### HIGH

**HIGH-1: `audit_logs` has no INSERT policy (CONFIRMED)**

File: `supabase/004_rls_admin.sql`. Only a SELECT policy exists. If RLS is enabled on `audit_logs`, authenticated users cannot write audit entries — this silently fails in `useWelds.ts` line 145 (`supabase.from('audit_logs').insert(...)`).  
Result: audit trail is silently incomplete for all weld status changes made through the client.

**HIGH-2: `weld_photos` has no UPDATE policy (CONFIRMED)**

File: `supabase/005_nde_photos.sql`. SELECT, INSERT, DELETE policies exist but no UPDATE. Caption edits or metadata updates via an authenticated client will silently fail.

**HIGH-3: Storage object paths are not tenant-scoped in INSERT policy (CONFIRMED)**

File: `supabase/005_nde_photos.sql`:
```sql
CREATE POLICY "org_members_upload_weld_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'weld-photos');
```
Any authenticated user can upload to any path in the `weld-photos` bucket, including paths that appear to belong to other organizations. Object path format is not verified or constrained.

---

### MEDIUM

**MED-1: `spool_items` uses `get_my_org_id()` while all other tables use `my_org_id()` (INFERRED)**

File: `supabase/setup-all.sql`. If these are two different functions with different implementations, the policy behavior may diverge. If one is a stub or alias that lacks the same security guarantees, `spool_items` isolation differs from the rest.

**MED-2: No `FORCE ROW LEVEL SECURITY` on any audited table (CONFIRMED from migrations)**

Without `FORCE RLS`, the table-owner role (`postgres`) bypasses all policies. If any code path directly or indirectly uses the `postgres` role, RLS is bypassed silently.

**MED-3: Admin layout protection is client-side only (CONFIRMED)**

File: `src/app/(admin)/layout.tsx` (from prior audit). `useEffect`-based redirect fires after render — server-side guard absent.

---

### LOW

**LOW-1: `notFound()` is called for both genuine 404 and auth-filtered results (CONFIRMED)**

On all three detail pages, a record that exists but belongs to another org produces a 404 — identical to a record that never existed. This makes security incidents invisible in logs and user-facing responses.

---

## 4. Corrected Architecture

### Prerequisite: Verify and Enable RLS

Before any code change, the following must be confirmed and fixed in the database:
- Run `ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;`
- Run `ALTER TABLE public.welds ENABLE ROW LEVEL SECURITY;`
- Run `ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;`
- Add INSERT policy to `audit_logs`
- Fix storage policies for `weld-photos` bucket

### Per-Page, Per-Operation Corrected Design

**ProjectDetailPage** (`src/app/(dashboard)/projects/[id]/page.tsx`):
- Auth check: `getCallerProfile()` — **fail closed**: if `null` or `organization_id` is null/empty, throw `notFound()` with a logged auth error before any query
- Client to use: `createAdminClient()` retained for SSR (cookie-independent), scoped by `.eq('organization_id', caller.organization_id)` — `organization_id` must be validated non-empty before use
- RLS carries guarantee: YES for client-side refetch via `useProjects` (already org-filtered in app code); `projects` RLS must be confirmed enabled
- Fail-closed behavior: explicit `if (!caller?.organization_id) { log('auth: null org_id'); return notFound() }` before any query

**SpoolDetailPage** (`src/app/(dashboard)/spools/[id]/page.tsx`):
- Same pattern as ProjectDetailPage
- `fetchSpool` (client-side) must add `.eq('organization_id', profile.organization_id)` filter — currently has none

**WeldDetailPage** (`src/app/(dashboard)/welds/[id]/page.tsx`):
- Same pattern
- `fetchWeld` (client-side) must add `.eq('organization_id', ...)` filter on all three sub-queries
- `audit_logs` INSERT policy must exist before removing admin client for writes

**Storage — `weld-photos` bucket:**
- Change bucket to `public: false`
- Update storage SELECT policy to scope by org path prefix:
  ```sql
  USING (bucket_id = 'weld-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  ```
  Or better, scope by org_id in the path: `{org_id}/{weld_id}/{filename}`
- All existing photo URLs become invalid — require signed URL generation or migration of paths

---

## 5. Exact Implementation Sequence

Each step is independently verifiable before the next begins.

**Step 0 — Database: Verify RLS state (prerequisite, blocks all other steps)**
- Query: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('projects','welds','audit_logs','spools','spool_items','weld_photos');`
- Expected: all six rows return `rowsecurity = true`
- If any return `false`, run the migration in Step 1 before proceeding
- Verification: re-run the query, confirm all `true`

**Step 1 — Migration: Enable RLS and add missing policies**
- File: create `supabase/migrations/YYYYMMDD_enable_rls_core_tables.sql` (do not create during this audit)
- SQL to include:
  ```sql
  -- Enable RLS on tables missing it
  ALTER TABLE public.projects    ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.welds       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.audit_logs  ENABLE ROW LEVEL SECURITY;

  -- Add audit_logs INSERT policy (previously missing)
  CREATE POLICY "audit_logs_insert"
    ON public.audit_logs FOR INSERT
    WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());

  -- Add weld_photos UPDATE policy (previously missing)
  CREATE POLICY "weld_photos_update"
    ON public.weld_photos FOR UPDATE
    USING (public.is_platform_admin() OR organization_id = public.my_org_id());
  ```
- Must run **before** any code is deployed that removes the admin client
- Verification: `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'audit_logs';` must show both SELECT and INSERT policies

**Step 2 — Fix `organization_id ?? ''` to fail-closed**
- Files: all three detail pages
- Replace:
  ```ts
  if (!caller) notFound()
  // ...
  .eq('organization_id', caller.organization_id ?? '')
  ```
  With:
  ```ts
  if (!caller || !caller.organization_id) {
    console.error('[auth] detail page: caller has no organization_id', { path: params.id })
    notFound()
  }
  // ...
  .eq('organization_id', caller.organization_id)  // now guaranteed non-null
  ```
- Verification: unit test with a mocked `getCallerProfile` returning `{ organization_id: null }` — page must call `notFound()` before any Supabase call

**Step 3 — Add org filter to `fetchWeld` and `fetchSpool`**
- File: `src/hooks/useWelds.ts` and `src/hooks/useSpools.ts`
- `fetchWeld` must receive `organizationId` as a parameter and apply `.eq('organization_id', organizationId)` on all three sub-queries
- `fetchSpool` must receive `organizationId` as a parameter and apply `.eq('organization_id', organizationId)` on the spool query
- Callers of these functions (React Query hooks) must pass `profile.organization_id` — guard against null
- Verification: E2E test — Org A user navigates to `/welds/<org-B-weld-id>` — both server render and client refetch return 404/empty

**Step 4 — Fix storage bucket and policies**
- This step must be sequenced last — it invalidates all existing photo public URLs
- Change bucket to private, update storage policies with org-path scoping
- Migrate all `weld_photos.public_url` values to signed-URL generation pattern
- Verification: unauthenticated GET to a previously-public photo URL returns 403

**Step 5 — Admin layout: add server-side guard**
- Convert `src/app/(admin)/layout.tsx` to a Server Component
- Call `getCallerProfile()` server-side; redirect non-admins before rendering children
- Verification: direct URL navigation to `/admin/*` as a non-admin user returns redirect

---

## 6. Rollback Plan

**Step 0 (RLS enablement):** Enabling RLS is reversible: `ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;`. However, disabling RLS removes all policy enforcement — this should be treated as an emergency-only revert. Any mid-sequence revert leaves the table with RLS enabled but potentially with the old application code that relied on the admin client bypassing it. Safe.

**Step 1 (INSERT/UPDATE policies):** Reversible: `DROP POLICY "audit_logs_insert" ON public.audit_logs;`. No data is modified. Safe to revert at any point.

**Step 2 (fail-closed org_id check):** Pure code change. Revert by restoring `?? ''` pattern. No database state affected.

**Step 3 (org filter in client hooks):** Pure code change. Revert by removing the `organizationId` parameter. If reverted after Step 1 but with RLS now enabled, client-side reads are still protected by RLS. Safe.

**Step 4 (storage bucket privatization):** **PARTIALLY IRREVERSIBLE.** Once `public_url` values in the `weld_photos` table are migrated away from direct public URLs, restoring them requires knowing the original URL pattern. The bucket can be made public again, but existing signed URLs expire. A revert strategy requires: (a) keeping `public_url` column intact until fully verified, (b) adding a `signed_url_path` column alongside it rather than replacing it, (c) feature-flagging which column the UI reads. Making the bucket public again is a single SQL statement.

**Step 5 (admin layout):** Pure code change. Revert by restoring `'use client'` layout. No database state affected.

**Feature-flag strategy:** Steps 2 and 3 can be gated behind `process.env.NEXT_PUBLIC_STRICT_ORG_SCOPING === 'true'` to allow fast revert without redeployment. Steps 0 and 1 (database migrations) cannot be feature-flagged — they require a new migration to revert.

---

*End of Phase 0 audit. Awaiting `APPROVED: PHASE 1` before any implementation begins.*

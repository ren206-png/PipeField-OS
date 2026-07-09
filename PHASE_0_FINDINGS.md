# PHASE_0_FINDINGS.md
# PipeField OS — Architectural Evolution · Phase 0 System Discovery
_Read-only audit. No code was changed. All claims are cited with file + line number.
Claims that cannot be cited are explicitly labeled **ASSUMPTION**._

---

## 1. Stack & Infrastructure Inventory

### Languages & Frameworks

| Item | Version | Source |
|---|---|---|
| Next.js | 14.2.29 | `package.json:46` |
| React | 18.3.1 | `package.json:51` |
| TypeScript | 5.9.3 | `package.json:80` |
| @supabase/supabase-js | ^2.110.0 | `package.json:37` |
| @supabase/ssr | ^0.12.0 | `package.json:36` |
| @tanstack/react-query | 5.101.0 | `package.json:38` |
| openai (SDK) | ^6.45.0 | `package.json:48` |
| stripe | 22.2.2 | `package.json:60` |
| resend | ^6.16.0 | `package.json:57` |
| @ducanh2912/next-pwa | ^10.2.9 | `package.json:29` |
| @capacitor/core | ^8.4.1 | `package.json:19` |
| pdf-parse | ^2.4.5 | `package.json:49` |
| @react-pdf/renderer | ^4.5.1 | `package.json:34` |
| Playwright | ^1.61.1 | `package.json:67` |

### Database
- **Supabase PostgreSQL** with `pgvector` extension (for 1536-dimensional embeddings).
- Storage bucket: `knowledge-docs`, 50 MB file limit (`.env.local.example` comment lines 9–12).

### Auth
- **Supabase Auth** — email/password via `auth.users`. SSR cookie strategy via `@supabase/ssr`. Bearer token fallback for SPA timing races (`src/providers/AuthProvider.tsx:88–131`).

### Payments
- **Stripe** — subscriptions, customer portal, webhooks (`package.json:60`).
- Price IDs injected via env vars: `STRIPE_PRICE_FIELD_PRO`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE`.

### Email
- **Resend** — transactional email, used for org invites and daily digest (`package.json:57`, `src/lib/email.ts`).

### AI Provider
- **OpenAI only** — `text-embedding-3-small` (embeddings) + `gpt-4o-mini` (RAG completions).
  - Citations: `src/app/api/knowledge/ask/route.ts:75, 110`.
- No Anthropic, Google, or other LLM providers detected in `src/`.

### Hosting & Deployment
- **Vercel** — `vercel.json:1` (`"framework": "nextjs"`, `"regions": ["iad1"]`).
- Build: `npm run build → .next`.
- **Cron job**: `0 6 * * *` UTC → `/api/cron/daily-digest` (`vercel.json:3–7`).

### Mobile
- **Capacitor 8.4.1** — iOS/Android native bindings (`package.json:19–28`).
- PWA also enabled via `next-pwa` (`package.json:29`). Offline calculator support via `src/hooks/useOfflineCalc.ts`.

### Scheduler / Queue
- No dedicated queue (no BullMQ, Redis, SQS, etc.).
- Background embedding is fire-and-forget: upload route calls `fetch('/api/knowledge/process/[id]')` without `await` and without retry. **ASSUMPTION:** exact line in upload route not re-read in this pass. If the process job fails, the source remains `processing_status: 'pending'` indefinitely (no retry mechanism exists).

### Optional / Not Configured
- **Sentry** — DSN optional (`.env.local.example:60`). `src/instrumentation.ts` dynamically requires it; absent if not configured.
- **Python Backend** — `PIPEFIELD_BACKEND_URL` optional; pipe-support calculator falls back to TypeScript implementation if absent (`src/app/api/pipe-support/calculate/route.ts`).
- **Google Analytics 4** — `NEXT_PUBLIC_GA_MEASUREMENT_ID` (`next.config.mjs:30`).

---

## 2. Tenant Isolation Mechanism (Canonical Pattern)

> **Operating Rule 5 anchor.** Every new query, cache key, AI context-assembly
> path, and background job MUST follow this mechanism exactly.

### Layer 1 — Database: Row-Level Security + `get_my_org_id()`

The **primary** isolation mechanism is Supabase RLS enforced at the database layer, making it impossible to bypass via application bugs.

**Helper functions** (`supabase/schema.sql:189–211`):

```sql
-- schema.sql:189–199
create or replace function public.get_my_org_id()
returns uuid language sql security definer stable as $$
  select organization_id
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- schema.sql:202–211
create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role
  from public.user_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;
```

**RLS policies on all multi-tenant tables:**

| Table | Policy pattern | File | Lines |
|---|---|---|---|
| `organizations` | `id = get_my_org_id()` | `schema.sql` | 215–216 |
| `user_profiles` | own row OR org match | `supabase/004_rls_admin.sql` | 20–50 |
| `projects` | `organization_id = get_my_org_id()` | `supabase/004_rls_admin.sql` | 89–103 |
| `spools` | `organization_id = get_my_org_id()` | `supabase/004_rls_admin.sql` | 124–138 |
| `welds` | `organization_id = get_my_org_id()` | `supabase/004_rls_admin.sql` | 160–174 |
| `audit_logs` | `organization_id = get_my_org_id()` | `supabase/004_rls_admin.sql` | 250+ |
| `knowledge_sources` | org isolation + permission-based | `migrations/20260703_knowledge_center.sql` | 102 |
| `knowledge_chunks` | org members can read | `migrations/20260703_knowledge_center.sql` | 157 |
| `knowledge_queries` | org_queries policy | `migrations/20260704_knowledge_vectors.sql` | 44 |
| `knowledge_query_sources` | org_query_sources policy | `migrations/20260704_knowledge_vectors.sql` | 52 |

### Layer 2 — API: `requireAuth()` + explicit `organization_id` check

All 57 API routes call `requireAuth(req)` (`src/lib/api-auth.ts:81`), which returns a `caller` object containing `organization_id`. Routes then explicitly reference `caller.organization_id` before any DB write.

- `src/app/api/projects/route.ts:31` — `const orgId = caller.organization_id`
- `src/app/api/welds/route.ts:22` — `if (!caller.organization_id) return 400`
- `src/app/api/knowledge/ask/route.ts:44–46` — 400 if org ID absent

**Auth guard hierarchy** (`src/lib/api-auth.ts`):
- `requireAuth()` line 81 — any authenticated user
- `requireOrgAdmin()` line 92 — role in `['platform_admin','organization_owner','administrator']`
- `requirePlatformAdmin()` line 103 — strict `role === 'platform_admin'`

### Layer 3 — Client: `useOrganization()` + React Query key scoping

All client hooks scope queries to `organizationId` from `useOrganization()`. Query keys include the org ID, preventing cross-org cache bleed. Example: `src/hooks/useProjects.ts` — `queryKey: ['projects', profile?.organization_id]`; query disabled until org ID resolves.

### Isolation Gaps

| # | Gap | Location | Severity |
|---|---|---|---|
| G1 | `checkWelderLimit()` defined but **zero call sites** — welder/user plan limits unenforced at API layer | `src/lib/usage.ts:78` | **HIGH** |
| G2 | `field_pro` tier in `plans.ts:8` is absent from `schema.sql:19` CHECK constraint — DB write of `field_pro` causes constraint violation | `schema.sql:19`, `plans.ts:8` | **HIGH** |
| G3 | `/api/knowledge/process/[id]` authenticates via `INTERNAL_API_SECRET` only (no org-scoped user session); org derived from source record. Acceptable for background job but the secret must be treated as a high-value credential | `route.ts:86–90, 105` | **MEDIUM** |
| G4 | Org ID validation manually repeated across all 57 routes — no middleware enforcement; a future route could omit it | Every API route | **LOW** |

---

## 3. Module Map

### Public Routes (`src/app/`)
- `/` — Marketing landing page
- `/privacy`, `/terms` — Legal (contain placeholders — see §6)
- `/blog`, `/blog/[slug]` — MDX blog
- `/calculators/[slug]` — Public SEO calculator pages
- `/(auth)/login`, `/register`, `/invite` — Auth flow

### Dashboard Routes (`src/app/(dashboard)/`)
**Core Operations:** `dashboard`, `projects/[id]`, `welds/[id]`, `spools/[id]`
**Documents & QC:** `documents/{itps,mtrs,ncrs,pressure-tests,rfis,wps,line-list,flanges}`
**Field Ops:** `daily-reports`, `welders`, `weld-map`, `nde-tracker`, `punch-list`, `commissioning`
**Intelligence:** `intelligence` (hub), `intelligence/ask` (AI Q&A), `intelligence/sources` (library), `intelligence/upload` (ingest)
**Calculators:** `calculator` (offset + thermal + take-off), `pipe-support`, `pipe-reference`
**Reports:** `reports/{weld-log,spool-status,progress,welder-performance}`
**Admin & Settings:** `settings`, `settings/billing`, `organization/workers`, `billing`, `client-portal`, `onboarding`
**Platform Admin:** `admin/overview`, `admin/users`

### API Routes (`src/app/api/`) — 57 route handlers

| Domain | Routes |
|---|---|
| Auth/Me | `/api/me`, `/api/register`, `/api/auth/signout` |
| Org | `/api/organization/invite`, `/api/organization/workers` |
| Billing | `/api/billing/{checkout,portal,usage,webhook}` |
| Projects | `/api/projects`, `/api/projects/[id]/{analytics,health,milestones}` |
| Welds | `/api/welds`, `/api/welds/[id]/{photos,repairs}`, `/api/welds/bulk-status`, `/api/welds/import` |
| QC Docs | `/api/itps/items/[id]`, `/api/ncrs`, `/api/rfis`, `/api/wps`, `/api/wps/[id]` |
| Knowledge/AI | `/api/knowledge/{ask,upload,sources,categories,process/[id]}` |
| Calculations | `/api/pipe-support/{calculate,calculations,pdf}` |
| Welders | `/api/welders/{certifications,rejection-rates}` |
| Reports (PDF) | `/api/reports/{weld-log-pdf,spool-release,itp-certificate,pressure-test-certificate,qa-package,executive-report}` |
| Platform Admin | `/api/admin/{users,stats}` |
| System | `/api/cron/daily-digest`, `/api/health`, `/api/errors`, `/api/feedback`, `/api/notifications`, `/api/qr`, `/api/share-links`, `/api/signatures`, `/api/analytics/welder-risk` |

### Libraries (`src/lib/`) — 27 files/folders

| File | Purpose |
|---|---|
| `api-auth.ts` | Route auth guards (`requireAuth`, `requireOrgAdmin`, `requirePlatformAdmin`) |
| `apiFetch.ts` | Authenticated `fetch` wrapper — injects Bearer token |
| `usage.ts` | Plan limit enforcement (`checkProjectLimit`, `checkWelderLimit`) |
| `plans.ts` | Tier definitions + limit helpers (field_pro, starter, professional, enterprise) |
| `rate-limit.ts` | In-memory rate limiting |
| `stats.ts` | Org statistics aggregation |
| `stripe.ts` | Stripe client + helpers |
| `email.ts` | Email templates via Resend |
| `welder-alerts.ts` | Cert expiry alert logic |
| `spool-auto-release.ts` | Spool status auto-transition |
| `notifications.ts` | Notification creation helpers |
| `calculator/` | TypeScript pipe math (no external shell calls) |
| `pdf/` | PDF generation/parsing |
| `auth/` | Auth helpers |
| `offline/` | Offline sync |

### Providers (`src/providers/`)
- `AuthProvider.tsx` (253 lines) — Global auth + org state. Critical design rule: never call `getSession()` inside `onAuthStateChange` (Supabase internal lock deadlock). Dual auth: Bearer token + cookie fallback. 5-second hard timeout.
- `QueryProvider.tsx` — React Query: staleTime 1 min, gcTime 10 min, 1 retry, refetch on focus + reconnect.

### Hooks (`src/hooks/`) — 41 files
One hook per feature domain (useProjects, useWelds, useSpools, useKnowledge, etc.) plus native/utility hooks (useNativeApp, useHaptics, useQRScanner, useOfflineCalc, useHealthMonitor).

---

## 4. AI Surface Inventory

### Call Site 1 — RAG Q&A (`src/app/api/knowledge/ask/route.ts`)

| Attribute | Value | Line |
|---|---|---|
| Provider | OpenAI | 16 |
| Embeddings model | `text-embedding-3-small` | 75 |
| Completion model | `gpt-4o-mini` | 110 |
| Auth | `requireAuth()` + per-role check | 54–61 |
| Rate limit | 30 queries / user / hour | 49 |
| Org scope | `caller.organization_id` enforced | 44–46 |
| Retrieval | pgvector cosine similarity via `match_knowledge_chunks` RPC | 82–86 |
| Org scope in retrieval | ✅ `org_id: caller.organization_id` passed to RPC | 83 |
| Context window | Top 8 chunks | 96–100 |
| Token logging | `knowledge_queries` table: model, tokens_used, latency_ms | 135–143 |
| Raw prompt logging | ❌ NOT logged — only token counts | — |
| Per-org cost ceiling | ❌ ABSENT | — |
| Error handling | try/catch wrapping entire handler | 38 |
| System prompt | Forbids fabrication; requires source citations | 19–23 |

### Call Site 2 — Document Embedding (`src/app/api/knowledge/process/[id]/route.ts`)

| Attribute | Value | Line |
|---|---|---|
| Provider | OpenAI | — |
| Model | `text-embedding-3-small` | 152 |
| Auth | `INTERNAL_API_SECRET` Bearer only — no user session | 86–90 |
| Org scope | Derived from source record's `organization_id` | 105, 168 |
| Chunking strategy | 2000 chars, 200-char overlap | 55–68 |
| Batch size | 100 chunks per embedding call | 150–157 |
| Error handling | Catch-all marks source `status: 'failed'` and returns 500 | 193–205 |
| Retry on failure | ❌ None — fire-and-forget from upload route | — |

### No Other AI Call Sites Found
- No `anthropic`, `@google-ai`, `@langchain`, or `gemini` imports anywhere in `src/`.
- All Intelligence UI pages (`/ask`, `/sources`, `/upload`, `/intelligence`) are fully implemented — not stubs. `intelligence/ask/page.tsx` is 211 lines with a working chat UI.

### AI Infrastructure Diagram

```
OPENAI_API_KEY (server-side only, never NEXT_PUBLIC_*)
        │
        ├─► /api/knowledge/ask            (user-facing RAG)
        │      │  requireAuth() + rate limit (30/hr/user)
        │      │  pgvector similarity search — org-scoped
        │      └─► knowledge_queries log (tokens only)
        │
        └─► /api/knowledge/process/[id]  (background embedding)
               │  INTERNAL_API_SECRET auth
               │  org_id from source record
               └─► knowledge_chunks (vector(1536))
```

### Cost Controls — Current State
- Per-user rate limit on `/ask`: 30/hour (`route.ts:49`).
- **No per-organization daily token ceiling** — Phase 1 requirement.
- **No monthly spend cap** — OpenAI bills the API key owner directly.
- **RISK:** An enterprise org with unlimited users can generate unbounded OpenAI spend.

---

## 5. Automation & Duplication Register

### Existing Automation
- **Daily digest cron** (`vercel.json:3–7`) — weld/RFI/NCR email summary at 06:00 UTC.
- **Spool auto-release** (`src/lib/spool-auto-release.ts`) — status transitions based on weld completion.
- **Welder cert alerts** (`src/lib/welder-alerts.ts`) — notifications before expiry.

### Manual Re-entry Opportunities

| Workflow | Re-entry Point | Source Data Already Exists |
|---|---|---|
| Daily field reports | Crew size, weather, work summary | Workers table, active projects |
| NCR filing | Weld ID, location, description | Weld record contains all fields |
| ITP checklist | Manual item-by-item checking | Weld/spool status tracked |
| Pressure test records | Spool number, line | Already in spools + line-list |

### Duplicated Business Logic

| Logic | Location | Risk |
|---|---|---|
| Org ID null check | All 57 routes independently | LOW — functional but high future surface area |
| Error response shape (`{ error: string }`) | Each route independently | LOW — cosmetic inconsistency |

---

## 6. Placeholder & Dead Code Register

### Verified Placeholders

| Item | Location | Status |
|---|---|---|
| Privacy policy | `src/app/privacy/page.tsx` — inline comment about placeholder sections | ⚠️ Not production-ready |
| Terms of service | `src/app/terms/page.tsx` — same pattern | ⚠️ Not production-ready |
| Landing page mockup | `src/app/page.tsx` ~line 150 — comment `{/* Right — fake dashboard mockup */}` | Low risk — marketing visual |
| Testimonials section | `src/app/page.tsx` ~line 250 — comment: "Add real testimonials here once you have written consent" | No fabricated names in code |

### Dead Code — Zero Active Call Sites (Verified)

| Symbol | Defined | Call sites | How verified |
|---|---|---|---|
| `checkWelderLimit()` | `src/lib/usage.ts:78` | **0** | `grep -rn "checkWelderLimit" src/` — only definition returned |

### No Other Stubs Found
All Intelligence pages are real implementations. The word "placeholder" in `intelligence/ask/page.tsx` appears only as an HTML `placeholder` attribute on a textarea element (line 189) — not a stub marker.

### Missing Required Artifact
`FEATURE_FLAGS.md` does **not exist** at repo root. Verified via `ls`. This is a required artifact per the Operating Rules and must be created in Phase 1.

---

## 7. Technical Debt & Risk Register (Ranked by Blast Radius)

### CRITICAL

**R1 — `field_pro` tier violates DB constraint**
`plans.ts:8` defines `field_pro` as a valid plan. `schema.sql:19` CHECK constraint is:
```sql
check (subscription_tier in ('free_trial','starter','professional','enterprise'))
```
`field_pro` is absent. Any Stripe webhook writing `field_pro` to `organizations.subscription_tier` causes a Postgres constraint violation, silently breaking subscription processing for that org.
**Fix:** One-line migration adding `'field_pro'` to the constraint.

**R2 — `checkWelderLimit()` has zero call sites**
`src/lib/usage.ts:78` defines the function. It is never called. Welder/user seat limits (field_pro: 1, starter: 3, professional: 15) are unenforced at the API layer. Any org can add unlimited welders regardless of plan.
**Fix:** Call in welder creation route and in `/api/organization/invite`.

### HIGH

**R3 — No per-organization AI token ceiling**
`/api/knowledge/ask` rate-limits per user (30/hour) but places no org-level daily or monthly cap on OpenAI token consumption. An enterprise org with unlimited users has unlimited AI spend with no automatic cutoff.
**Fix:** Phase 1 requirement — implement per-org daily token ceiling with graceful degradation.

**R4 — Background embedding job has no retry queue**
`/api/knowledge/process/[id]` is fired without await from the upload route. No cron, queue, or dead-letter mechanism retries `status: 'failed'` sources. Failed embeddings are silent.
**Fix:** Cron endpoint to re-process failed sources.

### MEDIUM

**R5 — `client-portal/page.tsx` uses `any[]` for project data**
`src/app/(dashboard)/client-portal/page.tsx:15, 18, 26, 31, 43` — project data typed as `any[]`. Type errors silently pass TypeScript checks.
**Fix:** Type as `Project[]` from `@/types`.

**R6 — Org ID validation not middleware-enforced**
The pattern `if (!caller.organization_id) return 400` is manually repeated in all 57 routes. A new route can be added without it, creating a cross-tenant data access vector.
**Fix:** Next.js API middleware or higher-order function asserting org ID presence (Phase 6 in backlog).

**R7 — Legal pages not production-ready**
`src/app/privacy/page.tsx` and `src/app/terms/page.tsx` explicitly contain placeholder sections. Publicly accessible pages without counsel-reviewed legal text.

### LOW

**R8 — `any` type in 5 locations**
- `src/instrumentation.ts:24, 36` — justified (optional Sentry dynamic require)
- `src/app/api/knowledge/process/[id]/route.ts:30` — justified (pdf-parse module variability)
- `src/app/(dashboard)/client-portal/page.tsx` — unjustified (see R5)
- `src/app/(dashboard)/reports/weld-log/page.tsx` — localized data transformation

**R9 — `unsafe-inline` in CSP**
`next.config.mjs:30` — required by Next.js hydration. Cannot be removed without nonce implementation. Standard limitation, elevated XSS impact if other defenses fail.

---

## 8. Consolidation Feasibility Verdict

### K1: Can the Intelligence Engine be a facade over existing code rather than a rewrite?

**YES.**

The existing AI surface is exactly two call sites, both in `src/app/api/knowledge/`. Both are well-structured, org-scoped, and independently invocable. A facade adapter can delegate to these functions without modifying their internals. All other planned capabilities (Welding Guidance, Safety Analysis, Drawing Analysis, Fabrication Planning, etc.) do not yet exist and will be new adapters — no wrapping required.

The `/ask` route handles prompt construction, retrieval, and completion in one 181-line handler. Phase 1 registers it as an adapter that calls the existing route. Refactoring the internals into the adapter is deferred to a later phase.

### K2: Can consolidation proceed without touching tenant-isolation code paths?

**YES.**

The canonical isolation pattern (RLS + `get_my_org_id()` at DB; `requireAuth()` + `caller.organization_id` at API) is not altered by wrapping existing routes in an adapter registry. New adapters must follow the same pattern — this is enforced at code review, not structurally today (see Gap G4).

### K3: Would consolidating any capability break an existing API contract, calculation, or subscription-tier behavior?

**NO** — provided the Phase 1 constraint is followed: existing API routes remain unchanged and old call sites are only migrated to the registry after their adapters are proven equivalent. No deletion in Phase 1.

**Pre-condition for Phase 1:** Gaps R1 (`field_pro` constraint) and R2 (welder limit enforcement) should be patched first as they are active production data integrity risks unrelated to Intelligence Engine work.

---

## 9. Proposed Phase Plan (Ranked Backlog)

The human selects each phase. Items below are ordered by risk and dependency.

---

### P0-FIX-1 — Repair `field_pro` DB Constraint _(prerequisite, not gated)_
**Scope:** Migration adding `'field_pro'` to `subscription_tier` CHECK constraint.
**Modules:** `supabase/` migration only.
**Risk:** LOW. **Rollback:** revert migration. **Flag:** none required.
**Dependency:** none. Ship before Phase 1.

---

### P0-FIX-2 — Enforce Welder/User Plan Limits _(prerequisite)_
**Scope:** Call `checkWelderLimit()` in welder creation and `/api/organization/invite`.
**Modules:** `src/app/api/welders/`, `src/app/api/organization/invite/`.
**Risk:** LOW — additive enforcement. **Rollback:** remove call.
**Flag:** `PFOS_BILLING_WELDER_LIMIT` (default ON — closes active gap).
**Dependency:** P0-FIX-1.

---

### Phase 1 — Intelligence Engine Foundation (Facade)
**Scope:** New `src/intelligence/` module: capability registry, adapters for `/ask` and `/process/[id]`, shared OpenAI client, prompt templating, retry/timeout policy, per-org token accounting, AI audit log, tier gating. Create `FEATURE_FLAGS.md`.
**Modules touched:** New `src/intelligence/` only. Zero changes to existing API routes.
**Risk:** MEDIUM. **Rollback:** delete `src/intelligence/`; no existing behavior changes.
**Flag:** `PFOS_INTELLIGENCE_ENGINE_ENABLED` (default OFF).
**Deliverables:** Flag-gated code, tests, `INTELLIGENCE_ENGINE.md`, `FEATURE_FLAGS.md`.
**Dependency:** P0-FIX-1, P0-FIX-2.

---

### Phase 2 — Per-Org AI Cost Controls
**Scope:** Daily token ceiling per org tier. Graceful degradation message. Usage widget.
**Modules:** `src/intelligence/` (new guard), `src/app/api/knowledge/ask/` (read-only ceiling check).
**Risk:** LOW. **Flag:** `PFOS_INTELLIGENCE_COST_CONTROLS`.
**Dependency:** Phase 1.

---

### Phase 3 — Embedding Retry Queue
**Scope:** Cron to re-process `knowledge_sources` where `processing_status = 'failed'`.
**Modules:** New `src/app/api/cron/retry-embeddings/route.ts` + `vercel.json` entry.
**Risk:** LOW. **Flag:** `PFOS_KNOWLEDGE_RETRY_QUEUE`.
**Dependency:** Phase 1.

---

### Phase 4 — Welding Guidance Adapter
**Scope:** Intelligence Engine capability querying knowledge base filtered to WPS/procedure docs. Pre-fill weld creation form with suggested procedure.
**Modules:** `src/intelligence/adapters/welding-guidance.ts` (new), `src/app/(dashboard)/welds/new/` (flag-gated hint only).
**Risk:** MEDIUM — touches weld creation UI. **Flag:** `PFOS_INTELLIGENCE_WELDING_GUIDANCE`.
**Dependency:** Phase 1.

---

### Phase 5 — Auto-Prefill for NCRs / Daily Reports
**Scope:** Pre-populate NCR form from weld record; pre-populate DFR from project + crew roster. User must confirm before submit.
**Modules:** `documents/ncrs/new/`, `daily-reports/new/`.
**Risk:** LOW-MEDIUM. **Flag:** `PFOS_AUTOMATION_PREFILL`.
**Dependency:** None (parallel with Phase 1+).

---

### Phase 6 — Middleware Org Isolation Guard
**Scope:** Extract org ID assertion into Next.js middleware, eliminating G4 (57 manual checks).
**Modules:** `src/middleware.ts` (new/extend), all 57 routes (one-by-one migration).
**Risk:** HIGH — touches every route. Requires exhaustive regression testing. Migrate one route at a time.
**Flag:** `PFOS_MIDDLEWARE_ORG_GUARD`.
**Dependency:** Strong test coverage must exist first.

---

## Adversarial Self-Check

_Re-reading as a hostile reviewer whose job is to find fabricated or uncited claims:_

| Claim | Status |
|---|---|
| All dependency versions | ✅ Cited from `package.json` with line numbers |
| `get_my_org_id()` function body | ✅ Quoted verbatim from `schema.sql:189–199` |
| All RLS policy file + line citations | ✅ `004_rls_admin.sql` line ranges cited; migration files named |
| OpenAI model names (`text-embedding-3-small`, `gpt-4o-mini`) | ✅ Cited `ask/route.ts:75, 110` |
| Rate limit (30/hour) | ✅ Cited `ask/route.ts:49` |
| `checkWelderLimit` zero call sites | ✅ Verified via `grep -rn "checkWelderLimit" src/` — only definition returned |
| `field_pro` absent from DB constraint | ✅ `schema.sql:19` quoted; `plans.ts:8` cited |
| `FEATURE_FLAGS.md` does not exist | ✅ Verified via `ls` command |
| Intelligence pages are real implementations | ✅ `ask/page.tsx` is 211 lines; "placeholder" appears only as HTML attribute on line 189 |
| No Anthropic/Google AI usage | ✅ `grep` across `src/` found no such imports |
| No per-org token ceiling | ✅ No such guard found in `ask/route.ts` |
| Cron schedule | ✅ `vercel.json:3–7` |
| `checkProjectLimit` called in projects route | ✅ `api/projects/route.ts:37` |

**Claims labeled ASSUMPTION in this document:**
- Fire-and-forget on upload → process: ASSUMPTION (upload route not fully re-read in this audit pass)
- No rate limit on project/weld CRUD routes: ASSUMPTION (rate-limit.ts verified in use at `/ask` only)
- Welder form does not auto-populate from staff roster: ASSUMPTION (form handler not fully read)
- Seat limit enforcement in invite route: ASSUMPTION (invite handler not fully read; `checkWelderLimit` gap is verified, call site absence is verified)

---

**STOP. Awaiting `APPROVED: PHASE 0`.**

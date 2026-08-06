# PHASE 0 — TRIAL FINDINGS: PipeField OS Stripe Free Trial Integration
**Date:** 2026-07-14  
**Analyst:** Claude Code (read-only; zero code changes made)  
**Scope:** Full codebase audit for Stripe free-trial integration readiness

---

## SECTION 1 — Current Signup Flow

### Entry Point
**File:** `src/app/(auth)/register/page.tsx` (all lines)

The signup is a two-step client-side form:
1. User enters organization name + admin user details (name, email, password) in a single screen.
2. On submit, the client calls `supabase.auth.signUp()` directly (line 71) to create the auth user.
3. The client then immediately calls `POST /api/register` (line 96-105) with the returned `authUserId`, `email`, `fullName`, and `organizationName`.
4. On success, the user is redirected to `/onboarding` via `window.location.href` (line 117).

### API Route: POST /api/register
**File:** `src/app/api/register/route.ts` (all lines)

**PATH A — New organization signup (lines 140-201):**

Step-by-step:
1. Rate-limit check: 5 requests per IP per 15 minutes (line 29).
2. Validate the `authUserId` belongs to the supplied email (line 49-51) — IDOR prevention.
3. Reject if account is older than 10 minutes (line 55).
4. Auto-confirm the user's email (line 60-62) — no email verification required.
5. Insert a new row into `public.organizations` (line 148-158):
   - `name`: organizationName
   - `slug`: slugified name (with collision retry at line 162-164)
   - `subscription_tier`: `'free_trial'`
   - `subscription_status`: `'trialing'`
   - `owner_user_id`: authUserId
6. Insert a row into `public.user_profiles` (line 173-183):
   - `auth_user_id`, `organization_id`, `email`, `full_name`
   - `role`: `'organization_owner'`
   - `status`: `'active'`, `is_active`: `true`
7. If profile insert fails, the organization row is deleted (line 186).
8. Fire-and-forget `sendWelcomeEmail` via Resend (line 190).
9. Insert a row into `public.organization_members` (line 192-198).
10. Return `{ success: true, orgId, path: 'new_org' }`.

**DB Tables Written at Signup:**
- `auth.users` (via Supabase auth, line 71 in register page)
- `public.organizations` (line 148, register route)
- `public.user_profiles` (line 173, register route)
- `public.organization_members` (line 192, register route)

### New Organization Record at Creation
**File:** `src/app/api/register/route.ts`, lines 148-158

```
organizations INSERT:
  name                → organizationName (user input)
  slug                → slugify(organizationName) or slugify+timestamp
  subscription_tier   → 'free_trial'
  subscription_status → 'trialing'
  owner_user_id       → authUserId (auth.users UUID)
```

Note: `stripe_customer_id`, `stripe_subscription_id`, `stripe_current_period_end`, `seat_limit` are NOT set at creation — they are null.

---

## SECTION 2 — Existing Billing State

### Stripe Package
**File:** `package.json`, line 63  
`"stripe": "22.2.2"` — present in production dependencies.  
`"@stripe/stripe-js": "9.8.0"` — client SDK also present (line 35).

### Stripe Server Client
**File:** `src/lib/stripe.ts` (all lines)

- Lazy-init Stripe client via `getStripe()` (line 14).
- Uses `STRIPE_SECRET_KEY` env var (line 17).
- Proxy alias `stripe` (line 33) for direct imports.
- Defines `PLANS` object (lines 42-109) with: `field_pro` ($9), `starter` ($49), `professional` ($149), `enterprise` ($399).
- Price IDs read from env vars: `STRIPE_PRICE_FIELD_PRO_MONTHLY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE` (lines 58, 74, 89, 103).
- Also defines `BILLING_PLANS` object (lines 115-136) — duplicate of `PLANS` with slightly different shape; used by billing page.

### Billing API Routes
**Directory:** `src/app/api/billing/`

| Route | File | Purpose |
|---|---|---|
| `POST /api/billing/checkout` | `src/app/api/billing/checkout/route.ts` | Creates Stripe Checkout session with `trial_period_days: 14` (line 104) |
| `POST /api/billing/portal` | `src/app/api/billing/portal/route.ts` | Opens Stripe Customer Portal |
| `GET /api/billing/usage` | `src/app/api/billing/usage/route.ts` | Returns plan, usage counts, limits |
| `POST /api/billing/webhook` | `src/app/api/billing/webhook/route.ts` | Receives and processes all Stripe events |

### Webhook Events Handled
**File:** `src/app/api/billing/webhook/route.ts`

Handled events (lines 75-215):
- `checkout.session.completed` — sets tier, status, subscription ID, period end
- `customer.subscription.created` / `customer.subscription.updated` — same
- `customer.subscription.deleted` — sets tier back to `'free_trial'`, status `'canceled'`
- `invoice.payment_succeeded` — sets status `'active'`, updates period end
- `invoice.payment_failed` — sets status `'past_due'`

The webhook updates `organizations` by `stripe_customer_id` (line 72 in `updateOrg`).

`tierFromPriceId()` function (lines 39-49): maps Stripe Price IDs to internal tier names by comparing against env vars. Returns `null` for unknown price IDs (no silent downgrade).

### Stripe Columns on Organizations
**File:** `supabase/billing.sql` (all lines — standalone migration, NOT in numbered sequence)

```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ;
```

**File:** `supabase/migrations/20260702_billing.sql` (all lines — formal migration)

```sql
alter table organizations add column if not exists stripe_customer_id text;
alter table organizations add column if not exists stripe_subscription_id text;
```

Note: The formal migration (20260702) does NOT set `UNIQUE` on `stripe_customer_id` nor add `stripe_current_period_end`. The `supabase/billing.sql` file adds both but is outside the migrations folder. This is a discrepancy — the live DB state may differ depending on which was run.

### Additional Billing Files
- `src/lib/plans.ts` — canonical plan definitions with limits (projects, users, welds)
- `src/lib/auth/permissions.ts` — `getPlanCapabilities()` function (lines 199-215) with tier-gated capabilities including `free_trial` (canInviteUsers: true, seatLimit: null)
- `src/intelligence/tier.ts` — `getOrgTier()` reads `subscription_tier` from DB for intelligence gating
- `src/components/billing/PricingCard.tsx`, `PlanBadge.tsx`, `UpgradePrompt.tsx`, `UsageBar.tsx` — client billing UI components
- `src/hooks/usePlanLimits.ts`, `src/hooks/useUsage.ts` — client hooks for plan/usage data
- `scripts/create-field-pro-stripe-products.ts` — one-time script to create Stripe products

### Stripe Env Vars Found
**File:** `.env.local.example` (lines 32-44)

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...
STRIPE_PRICE_FIELD_PRO=price_...
STRIPE_PRICE_FIELD_PRO_MONTHLY=price_...
STRIPE_PRICE_FIELD_PRO_ANNUAL=price_...
```

**Summary: Stripe integration is SUBSTANTIALLY COMPLETE.** The webhook, checkout, portal, and usage routes exist and are wired. A 14-day trial is already embedded in checkout sessions (checkout/route.ts line 104). The DB columns for Stripe IDs exist via migrations.

---

## SECTION 3 — Supabase/DB Schema

### ORM Pattern
This project uses **Supabase** (`@supabase/supabase-js` v2.110.0 and `@supabase/ssr`) — NOT Prisma. There is no `prisma/` directory, no `schema.prisma`, no `@prisma/client` in `package.json`. All DB operations use:
- `createClient()` from `src/lib/supabase/client.ts` (browser)
- `createServerClient()` from `@supabase/ssr` (server components)
- `createAdminClient()` from `src/lib/supabase/admin.ts` (API routes — bypasses RLS)

### Organizations Table Columns
**File:** `supabase/schema.sql`, lines 13-24 (base definition):

| Column | Type | Default | Constraint |
|---|---|---|---|
| `id` | uuid | uuid_generate_v4() | PRIMARY KEY |
| `name` | text | — | NOT NULL |
| `slug` | text | — | NOT NULL UNIQUE |
| `logo_url` | text | — | nullable |
| `subscription_tier` | text | `'free_trial'` | NOT NULL, CHECK in ('free_trial','starter','professional','enterprise') |
| `subscription_status` | text | `'trialing'` | NOT NULL, CHECK in ('active','trialing','past_due','canceled','paused') |
| `created_at` | timestamptz | now() | NOT NULL |
| `updated_at` | timestamptz | now() | NOT NULL |

**Added via migration `supabase/migrations/20260702_billing.sql`:**
- `plan` text NOT NULL DEFAULT 'free' (line 2 — NOTE: this conflicts with `subscription_tier`)
- `stripe_customer_id` text (line 3)
- `stripe_subscription_id` text (line 4)

**Added via migration `supabase/016_field_pro.sql` (lines 33-34):**
- `seat_limit` INTEGER DEFAULT NULL

**Added via `supabase/billing.sql` (standalone, lines 6-9):**
- `stripe_customer_id` TEXT UNIQUE (may conflict with 20260702 version)
- `stripe_subscription_id` TEXT
- `stripe_current_period_end` TIMESTAMPTZ

**Added via `supabase/001_platform_admin.sql` (line 47):**
- `owner_user_id` uuid REFERENCES auth.users(id)

### subscription_tier CHECK Constraint Evolution
The constraint has been modified multiple times:
1. `schema.sql` line 19: `('free_trial','starter','professional','enterprise')` — no field_pro
2. `016_field_pro.sql` lines 20-27: adds `'field_pro'`
3. `migrations/20260708_intelligence_engine.sql` lines 14-23: re-applies with all 5 values

### Columns NOT Yet Present (Needed for Free Trial Integration)
- `trial_ends_at` (TIMESTAMPTZ) — does NOT exist anywhere in schema or migrations
- The `stripe_current_period_end` column from `supabase/billing.sql` is the closest existing equivalent but is semantically different (subscription billing period, not trial expiry)

### Where New Trial Columns Should Attach
New columns for the free-trial feature should be added via a new migration file:
`supabase/migrations/20260715_free_trial.sql`

Columns to add:
- `trial_ends_at TIMESTAMPTZ` — when the free trial expires
- `stripe_customer_id TEXT UNIQUE` (if not already in live DB from billing.sql)
- `stripe_subscription_id TEXT` (if not already present)
- `stripe_current_period_end TIMESTAMPTZ` (if not already present)

`subscription_tier` and `subscription_status` columns already exist and already default to `'free_trial'` / `'trialing'` — no new columns needed for those.

---

## SECTION 4 — Email/Notification Infrastructure

### Email Provider
**File:** `src/lib/email.ts` (all lines)  
Provider: **Resend** (`"resend": "^6.16.0"` in package.json line 60).  
Lazy-init via `getResend()` (line 17), requires `RESEND_API_KEY` env var.  
FROM address: `process.env.EMAIL_FROM ?? 'PipeField OS <onboarding@resend.dev>'` (line 26).

### Existing Email Templates
All templates are inline HTML in `src/lib/email.ts`:
- `sendWeldStatusEmail()` — weld status change notification (line 42)
- `sendDailyReportEmail()` — daily report submitted (line 153)
- `sendShareViewEmail()` — share link viewed (line 202)
- `sendCertExpiryEmail()` — welder certification alert (line 256)
- `sendWelcomeEmail()` — new user welcome (line 322)

### Existing Cron/Scheduler Infrastructure
**File:** `vercel.json` (all lines)

Three Vercel Cron jobs are registered:
1. `/api/cron/daily-digest` — `0 6 * * *` (06:00 UTC daily) — cert expiry alerts + daily activity digest
2. `/api/cron/health-monitor` — `*/5 * * * *` (every 5 minutes)
3. `/api/cron/support-photo-cleanup` — `0 3 * * *` (03:00 UTC daily)

**File:** `src/app/api/cron/daily-digest/route.ts` — uses `createAdminClient()`, iterates orgs, sends `sendCertExpiryEmail` and digest emails via Resend.

### Phase 3 Trial Notification Compatibility
**Yes, existing infrastructure supports trial notification emails.** The approach would be:
1. Add a new `sendTrialExpiryEmail()` function to `src/lib/email.ts` following the same pattern.
2. Add a new Vercel Cron entry in `vercel.json` (e.g., `/api/cron/trial-expiry-check` at `0 9 * * *`).
3. The cron handler queries organizations where `trial_ends_at` is within N days and sends reminder emails.

---

## SECTION 5 — Environment/Config

### Stripe Env Vars (from .env.local.example, lines 32-44)
| Variable | Purpose | Status |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server-side Stripe API key | Documented, used in `src/lib/stripe.ts:17` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Documented, used in `webhook/route.ts` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe.js | Documented (NOT `STRIPE_PUBLISHABLE_KEY`) |
| `STRIPE_PRICE_FIELD_PRO_MONTHLY` | Field Pro monthly price ID | Documented + used in `stripe.ts:58` |
| `STRIPE_PRICE_FIELD_PRO` | Field Pro generic price ID | Documented + used in `plans.ts:10` |
| `STRIPE_PRICE_STARTER` | Starter price ID | Documented + used in `stripe.ts:74` |
| `STRIPE_PRICE_PROFESSIONAL` | Professional price ID | Documented + used in `stripe.ts:89` |
| `STRIPE_PRICE_ENTERPRISE` | Enterprise price ID | Documented + used in `stripe.ts:103` |
| `STRIPE_PRICE_FIELD_PRO_ANNUAL` | Annual billing (TODO) | Documented, commented out in stripe.ts:50 |

### Additional Env Vars Needed for Free Trial Integration
- None beyond what already exists if the trial is pure DB-state (no new Stripe price needed for a free trial — just set `trial_ends_at = now() + 14 days` at org creation).
- If a Stripe free-trial subscription is desired, the existing checkout flow already sets `trial_period_days: 14` (checkout/route.ts line 104).

### Deployment
Secrets live in Vercel project environment variables (referenced throughout env.local.example).  
`vercel.json` handles cron and build config.

---

## SECTION 6 — Auth/Middleware

### Middleware
**File:** `src/middleware.ts` (all lines)

The middleware runs on every non-static request. Its sole job is:
1. Refresh the Supabase session (call `supabase.auth.getUser()` at line 72 — validates and refreshes the JWT).
2. Write refreshed tokens back to both request and response cookies (setAll callback, lines 56-68).
3. If not logged in and accessing a protected page: redirect to `/login` (lines 82-85).
4. If logged in and accessing `/login` or `/register`: redirect to `/dashboard` (lines 88-91).
5. API routes always pass through after session refresh — no redirect (lines 75-77).

**No subscription_tier or trial expiry checks exist in middleware.** The middleware is purely auth-based.

### Where to Insert a Trial-Expired Gate
Two options:
1. **Middleware (recommended for hard gate):** After line 91 (logged-in + dashboard check), add a check: fetch org from DB, if `trial_ends_at < now()` AND `subscription_status === 'trialing'`, redirect to `/billing` or `/trial-expired` page. Only applies to non-billing routes.
2. **Dashboard layout (`src/app/(dashboard)/layout.tsx`):** Add a server-side check that reads org tier/status and renders a "Trial Expired" banner or blocks access.

The middleware approach is preferred for a hard block; the layout approach is better for a soft banner.

### requireAuth — What It Returns
**File:** `src/lib/api-auth.ts` (all lines)

`requireAuth()` calls `getCallerProfile()` which returns a `CallerProfile` (lines 19-26):
```typescript
interface CallerProfile {
  id:              string
  auth_user_id:    string
  role:            string
  organization_id: string | null
  full_name:       string | null
  status:          string | null
}
```

**The CallerProfile does NOT include `subscription_status`, `subscription_tier`, or `trial_ends_at`.** API routes that need to gate on trial status must separately query the `organizations` table after calling `requireAuth()`.

### Existing Subscription Checks in Code
- `src/lib/auth/permissions.ts` lines 199-215: `getPlanCapabilities(tier)` maps tier strings to capabilities. `'free_trial'` gets `canInviteUsers: true, canManageOrganization: true, seatLimit: null`.
- `src/intelligence/tier.ts` lines 14-26: `getOrgTier()` fetches org tier for intelligence gating.
- `src/app/api/billing/usage/route.ts`: maps `'free_trial'` to `DEFAULT_PLAN = 'starter'` for limit purposes (line 22-28).

---

## SECTION 7 — Feature Flag Mechanism

### Pattern
**File:** `src/intelligence/flags.ts` (all lines)

```typescript
export const FLAGS = {
  PFOS_INTELLIGENCE_ENGINE_ENABLED: process.env.PFOS_INTELLIGENCE_ENGINE_ENABLED === 'true',
  // ...more flags
} as const

export type FlagName = keyof typeof FLAGS

export function isFlagEnabled(flag: FlagName): boolean {
  return FLAGS[flag]
}
```

All flags:
- Are declared as `const` properties in the `FLAGS` object (lines 10-64).
- Read directly from `process.env.FLAGNAME === 'true'` at module load time.
- Default to `false` unless the env var is explicitly set to `'true'`.
- One exception: `PFOS_BILLING_WELDER_LIMIT` (line 54) defaults `!== 'false'` (defaults ON).
- Named with `PFOS_` prefix convention.

### Adding FEATURE_TRIAL_BILLING
Following the exact pattern, add to `src/intelligence/flags.ts` inside the `FLAGS` object:

```typescript
// Free trial + billing enforcement (Phase X)
// When ON: enforces trial_ends_at expiry gate, redirects expired orgs to billing.
// When OFF: free_trial orgs have unlimited access (legacy behavior).
PFOS_TRIAL_BILLING_ENABLED: process.env.PFOS_TRIAL_BILLING_ENABLED === 'true',
```

Then add a named export below the FLAGS object (following the pattern at lines 77-83):

```typescript
export const TRIAL_BILLING_ENABLED = isFlagEnabled('PFOS_TRIAL_BILLING_ENABLED')
```

Usage in middleware or layout: `import { TRIAL_BILLING_ENABLED } from '@/intelligence/flags'`

---

## SECTION 8 — Risk Register

### Risk 1: `20260702_billing.sql` vs `supabase/billing.sql` — Column Duplication/Conflict
**Files at risk:**
- `supabase/migrations/20260702_billing.sql`
- `supabase/billing.sql`

**Risk:** The formal migration adds `stripe_customer_id` WITHOUT `UNIQUE` constraint. The standalone `billing.sql` adds it WITH `UNIQUE` and also adds `stripe_current_period_end`. If both were run, `stripe_customer_id` exists without uniqueness. If only `billing.sql` was run (not in migrations folder), it may not have been tracked by Supabase migration tooling. The webhook (`webhook/route.ts` line 72) updates `organizations` by `stripe_customer_id` — without uniqueness, this could match multiple rows. Additionally, `20260702_billing.sql` adds a `plan` column (line 2) that is never referenced in application code — this is dead schema.

**Impact:** High — potential silent multi-row updates from webhook; DB state uncertainty.

### Risk 2: `subscription_tier` CHECK Constraint Has Been Redefined Three Times
**Files at risk:**
- `supabase/schema.sql` line 19
- `supabase/016_field_pro.sql` lines 20-27
- `supabase/migrations/20260708_intelligence_engine.sql` lines 14-23

**Risk:** The constraint is dropped and recreated in multiple migration files. A new migration adding `'trialing'` or any new tier must also DROP and recreate this constraint — failure to do so will cause INSERT failures for new orgs with the new tier. The live constraint state depends on migration execution order, which is not fully deterministic from the file names (some files are in `supabase/` root, some in `supabase/migrations/`).

**Impact:** Medium — new migration for trial integration must handle this carefully.

### Risk 3: `trial_period_days: 14` Already in Checkout — Conflicts with DB-Level Trial
**File at risk:** `src/app/api/billing/checkout/route.ts`, line 104

**Risk:** The existing checkout session already sets `trial_period_days: 14`. If a separate DB-level `trial_ends_at` free trial is added, there are now two trial mechanisms:
1. DB-level `trial_ends_at` (free access, no card required)
2. Stripe-level `trial_period_days: 14` (card captured at checkout start, free for 14 days)

These could conflict: a user on the free DB trial who upgrades via checkout would start a SECOND Stripe trial, potentially delaying their first charge by 14 days even after the DB trial expired. This needs explicit handling (set `trial_end` to `now()` on checkout, or remove `trial_period_days` from checkout once the DB trial paradigm is adopted).

**Impact:** High — double trial could mean significant revenue delay for early adopters.

### Risk 4: `requireAuth` CallerProfile Does Not Expose Trial Status
**File at risk:** `src/lib/api-auth.ts`, lines 19-26

**Risk:** Every API route that calls `requireAuth()` receives a `CallerProfile` that lacks `subscription_status`, `subscription_tier`, and `trial_ends_at`. Any trial-expiry enforcement at the API layer requires each route to make a SECOND DB query to fetch the org. If trial expiry enforcement is implemented inconsistently (some routes check, some don't), expired orgs can still write data via unguarded API routes. This is an architectural gap — the CallerProfile shape must be extended or a separate `requireActiveSubscription()` guard must be created.

**Impact:** High — inconsistent enforcement could allow data writes after trial expiry.

### Risk 5: `subscription_tier = 'free_trial'` Mapped to 'starter' for Limit Purposes
**File at risk:** `src/app/api/billing/usage/route.ts`, lines 22-28

**Risk:** `'free_trial'` and `'field_pro'` tiers are both mapped to `DEFAULT_PLAN = 'starter'` when resolving usage limits. This means free trial orgs get `starter` limits (3 users, 5000 welds, unlimited projects) via the usage API. If the intended free trial is more restrictive (e.g., 1 project, 50 welds), this mapping must be updated. Also, `getPlanCapabilities()` in `src/lib/auth/permissions.ts` line 204 gives `free_trial` orgs `seatLimit: null` (unlimited seats), while the `usage/route.ts` treats them as `starter` (3 users). These two functions contradict each other on seat limits.

**Impact:** Medium — free trial org limits are inconsistent between the two enforcement paths; could allow overuse or block legitimate use depending on which path is hit.

---

## DISCREPANCIES FROM PROMPT

The original prompt assumes this project uses **Prisma**. It does not:

| Prompt Assumption | Reality |
|---|---|
| "Prisma schema" | No `prisma/` directory, no `schema.prisma`, no `@prisma/client` in package.json |
| "Prisma migrations" | Migrations are raw SQL files in `supabase/migrations/` and `supabase/` root |
| "Prisma ORM/query pattern" | All queries use `@supabase/supabase-js` client (`createClient`, `createAdminClient`) |

**All recommendations in this document have been adapted accordingly:**
- Schema changes = new `.sql` file in `supabase/migrations/`
- DB operations = `createAdminClient()` or `createClient()` with Supabase query builder
- No Prisma generate, no Prisma migrate commands needed

Additional discrepancy: The prompt asks about adding `trialEndsAt`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, and `planPriceId` columns. Of these:
- `stripeCustomerId` → `stripe_customer_id` already exists (via billing migrations)
- `stripeSubscriptionId` → `stripe_subscription_id` already exists (via billing migrations)
- `subscriptionStatus` → `subscription_status` already exists (in schema.sql)
- `planPriceId` → does NOT exist; not needed since tier is stored as text enum and price IDs live in env vars
- `trialEndsAt` → `trial_ends_at` does NOT exist and is the primary missing column

---

## SUMMARY TABLE

| Area | Status | Key File |
|---|---|---|
| Signup flow | Fully implemented | `src/app/api/register/route.ts` |
| Stripe client | Implemented | `src/lib/stripe.ts` |
| Checkout | Implemented (14-day trial already set) | `src/app/api/billing/checkout/route.ts` |
| Webhook | Implemented | `src/app/api/billing/webhook/route.ts` |
| Portal | Implemented | `src/app/api/billing/portal/route.ts` |
| DB: stripe_customer_id | Exists (via migrations) | `supabase/billing.sql` |
| DB: trial_ends_at | MISSING — must add | new migration needed |
| Email: Resend | Implemented | `src/lib/email.ts` |
| Email: trial expiry template | MISSING | new function in email.ts |
| Cron: trial check | MISSING | new cron route + vercel.json entry |
| Middleware: trial gate | MISSING | `src/middleware.ts` |
| Feature flag | Pattern ready; flag not added | `src/intelligence/flags.ts` |
| CallerProfile: trial status | MISSING | `src/lib/api-auth.ts` |

---

AWAITING: APPROVED: PHASE 0

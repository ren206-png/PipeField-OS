# INTELLIGENCE_ENGINE.md
# PipeField Intelligence Engine — Design Document (Phase 1)

## Purpose

The Intelligence Engine is a server-side facade that consolidates all AI/LLM functionality in PipeField OS behind a single capability registry. It provides:

- A unified entry point (`intelligence.invoke()`) for all AI calls
- Shared infrastructure: one OpenAI client, retry policy, per-org token accounting, AI audit log
- Tier gating that reuses the existing subscription-tier logic
- Feature-flag control over every capability (default: all OFF)

## Module Structure

```
src/intelligence/
├── index.ts              Public API — import this, not internal files
├── types.ts              Core types (CapabilityName, InvocationContext, etc.)
├── flags.ts              Feature flag evaluation
├── client.ts             Shared OpenAI client factory + model constants
├── policy.ts             Retry + timeout policy (withRetry helper)
├── accounting.ts         Per-org daily token accounting
├── audit.ts              AI invocation audit log writer → ai_invocations table
├── tier.ts               Tier gating (wraps plans.ts + usage.ts)
├── registry.ts           Capability registry + invoke() entry point
└── adapters/
    ├── rag-qa.ts         ACTIVE — wraps /api/knowledge/ask logic
    ├── document-embedding.ts  ACTIVE — wraps /api/knowledge/process/[id] logic
    └── stubs.ts          NOT_IMPLEMENTED stubs for all future capabilities
```

## Adapter → Legacy Code Map

| Adapter | Status | Phase | Notes |
|---|---|---|---|
| `rag-qa` | ACTIVE | 1 | Wraps `/api/knowledge/ask` — RAG QA pipeline |
| `document-embedding` | ACTIVE | 1 | Wraps `/api/knowledge/process/[id]` — chunk + embed |
| `welding-guidance` | ACTIVE | 2 | WPS recommendation + cert checks — starter+ |
| `safety-analysis` | ACTIVE | 2 | Safety doc RAG analysis — all tiers |
| `qa-qc-assistance` | ACTIVE | 2 | NCR drafting / ITP guidance — starter+ |
| `pipefitter-assistant` | ACTIVE | 2 | Field-worker RAG assistant — starter+ |
| `material-takeoff` | ACTIVE | 2 | Spool BOM aggregation — starter+ |
| `inspection` | ACTIVE | 2 | ITP hold/witness point guidance — starter+ |
| `fabrication-planning` | ACTIVE | 2 | Spool sequence recommendations — professional+ |
| `estimating` | ACTIVE | 2 | Effort estimation from scope data — professional+ |
| `scheduling` | ACTIVE | 2 | Schedule health + recovery actions — professional+ |
| `drawing-analysis` | ACTIVE | 2 | Vision analysis of drawings (GPT-4o) — professional+ |
| `digital-twin` | ACTIVE | 2 | Operational status twin — enterprise only |

## Phase 1 Contract: Legacy Routes Are Unchanged

In Phase 1, the existing routes **are not modified**:
- `src/app/api/knowledge/ask/route.ts` — unchanged, continues to serve `/api/knowledge/ask`
- `src/app/api/knowledge/process/[id]/route.ts` — unchanged, continues to serve `/api/knowledge/process/[id]`

The Intelligence Engine adapters (`rag-qa`, `document-embedding`) replicate the same logic and can be called independently. Migration of live traffic to the engine happens in a later phase after equivalence is verified.

## Invocation Flow

```
Caller (API route / server action)
  │
  └─► intelligence.invoke(capability, ctx, input)
          │
          ├── Flag: PFOS_INTELLIGENCE_ENGINE_ENABLED?  → if OFF: return { ok: false, engine_disabled }
          ├── Adapter status: NOT_IMPLEMENTED?          → return { ok: false, not_implemented }
          ├── Tier: org allowed for this capability?    → if NO: log + return { ok: false, tier_blocked }
          ├── Budget: PFOS_INTELLIGENCE_COST_CONTROLS?  → if exceeded: log + return { ok: false, budget_exceeded }
          │
          └─► adapter.invoke(ctx, input)
                  │
                  ├── OpenAI API call(s)
                  ├── Supabase reads/writes (always org-scoped: ctx.organizationId)
                  └─► return AdapterResult<TOutput>
                          │
                          └─► logInvocation(ai_invocations table)
                                  │
                                  └─► return { ok: true, data, tokensUsed, latencyMs, model }
```

## Tenant Isolation in the Engine

Every adapter call enforces the canonical isolation pattern (Phase 0, §2):

1. `ctx.organizationId` is always derived from `requireAuth(req)` at the route level — never from user input.
2. All Supabase queries include `.eq('organization_id', ctx.organizationId)`.
3. pgvector RPC calls pass `org_id: ctx.organizationId`.
4. Cache keys (if added in future phases) must include `organizationId` as the first segment.
5. The `ai_invocations` audit log stores `organization_id` on every row with RLS enforced.

**No cross-tenant data ever enters the context of a different org's request.**

## Audit Log

All Intelligence Engine invocations are written to `public.ai_invocations` (created in `supabase/migrations/20260708_intelligence_engine.sql`).

Each row records: `organization_id`, `user_id`, `capability`, `model`, `tokens_used`, `latency_ms`, `flag_state`, `status`, `error_message`, `invoked_at`.

**Raw prompt content is never logged.** Only token counts and metadata.

This table has RLS: org members can read their own org's rows only.

## Cost Controls

When `PFOS_INTELLIGENCE_COST_CONTROLS=true`:
- Before each invocation, `getDailyUsage()` sums today's successful `tokens_used` from `ai_invocations` for this org + capability.
- If the org's tier budget is exhausted, the request is rejected with a clear user-facing message ("Daily AI usage limit reached...").
- Budget resets at midnight UTC (the query filters on `invoked_at >= today_start`).

Default daily budgets (configurable in `src/intelligence/accounting.ts`):

| Tier | `rag-qa` | `document-embedding` |
|---|---|---|
| free_trial | 5,000 tokens | 20,000 tokens |
| field_pro | 10,000 tokens | 50,000 tokens |
| starter | 25,000 tokens | 100,000 tokens |
| professional | 100,000 tokens | 500,000 tokens |
| enterprise | unlimited | unlimited |

## Adding a New Capability (Future Phases)

1. Define `TInput` and `TOutput` types.
2. Create `src/intelligence/adapters/<capability-name>.ts` implementing `CapabilityAdapter<TInput, TOutput>`.
3. Replace the stub in `src/intelligence/adapters/stubs.ts` with an import of the real adapter.
4. Register it in `src/intelligence/registry.ts` REGISTRY map.
5. Add the feature flag to `src/intelligence/flags.ts` and `FEATURE_FLAGS.md`.
6. Update this document's adapter table.
7. Gate on `PFOS_INTELLIGENCE_ENGINE_ENABLED` + the new capability flag before routing any live traffic.

## Database Schema Added (Phase 1)

**`public.ai_invocations`** — see `supabase/migrations/20260708_intelligence_engine.sql`

```sql
id               uuid        PRIMARY KEY
organization_id  uuid        NOT NULL → organizations(id)
user_id          uuid        → user_profiles(id) (nullable — background jobs)
capability       text        NOT NULL
model            text        NOT NULL
tokens_used      integer     NOT NULL DEFAULT 0
latency_ms       integer     NOT NULL DEFAULT 0
flag_state       jsonb       NOT NULL DEFAULT '{}'
status           text        NOT NULL CHECK IN ('success','error','rate_limited','tier_blocked')
error_message    text        (nullable)
invoked_at       timestamptz NOT NULL DEFAULT now()
```

RLS: org members SELECT their own rows. Any org member can INSERT (engine writes on their behalf).

## P0 Prerequisite Fixes (Shipped in Phase 1)

### P0-FIX-1 — `field_pro` DB constraint
Added `'field_pro'` to `subscription_tier` CHECK constraint via migration `20260708_intelligence_engine.sql`. This closes the constraint violation that would occur when the Stripe webhook writes `field_pro` to `organizations.subscription_tier`.

### P0-FIX-2 — Welder plan limit enforcement
- Added `POST /api/welders/route.ts` — creates welders server-side after calling `checkWelderLimit()`.
- Updated `src/hooks/useWelders.ts:useCreateWelder` to call `POST /api/welders` via `apiFetch` instead of writing directly to Supabase from the client (which bypassed the server-side limit check).
- Controlled by flag `PFOS_BILLING_WELDER_LIMIT` (default ON).

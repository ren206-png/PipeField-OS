// ============================================================
// AI Route Helper
//
// Shared boilerplate for all /api/ai/<capability> routes.
// Handles auth, rate-limit, context building, and engine invoke.
//
// Usage:
//   export const POST = makeAiRoute('welding-guidance', AI_ROLES)
//   — or —
//   export async function POST(req: NextRequest) {
//     return aiRoute(req, 'welding-guidance', AI_ROLES)
//   }
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { checkAiRateLimit, AI_HOURLY_LIMITS, DEFAULT_HOURLY_LIMIT } from '@/lib/ai-rate-limit'
import { invoke } from '@/intelligence'
import type { CapabilityName, InvocationContext } from '@/intelligence'

// Roles that may call AI capabilities.
// Tier gating inside the engine restricts professional/enterprise capabilities further.
export const AI_ROLES = [
  'platform_admin',
  'organization_owner',
  'administrator',
  'project_manager',
  'foreman',
  'qa_inspector',
  'shop_fabricator',
  'field_technician',
  'client_viewer',
] as const

export type AiRole = (typeof AI_ROLES)[number]

// ── Core helper ───────────────────────────────────────────────
export async function aiRoute<TInput, TOutput>(
  req:        NextRequest,
  capability: CapabilityName,
  allowedRoles: readonly string[] = AI_ROLES,
): Promise<NextResponse> {
  try {
    // 1. Auth
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    // 2. Role gate (coarse — engine enforces tier gate)
    if (!allowedRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // 3. Rate limit — DB-backed, works across all Vercel instances
    const hourlyLimit = AI_HOURLY_LIMITS[capability] ?? DEFAULT_HOURLY_LIMIT
    const rateCheck = await checkAiRateLimit({
      userId:         caller.id,
      organizationId: caller.organization_id,
      capability,
      limitPerHour:   hourlyLimit,
    })
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error:   `Rate limit reached: ${rateCheck.count}/${rateCheck.limit} requests this hour. Resets at ${new Date(rateCheck.resetAt).toUTCString()}.`,
          reason:  'rate_limited',
          resetAt: rateCheck.resetAt,
        },
        { status: 429 },
      )
    }

    // 4. Parse body
    const input = await req.json() as TInput

    // 5. Build invocation context — always org-scoped
    const ctx: InvocationContext = {
      organizationId: caller.organization_id,
      userId:         caller.id,
      authUserId:     caller.auth_user_id,
      capability,
      flagState:      {},
    }

    // 6. Invoke through engine (handles flag gate, tier gate, budget, audit log)
    const result = await invoke<TInput, TOutput>(capability, ctx, input)

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        engine_disabled: 503,
        not_implemented: 501,
        tier_blocked:    402,
        budget_exceeded: 429,
        error:           500,
      }
      return NextResponse.json(
        { error: result.message, reason: result.reason },
        { status: statusMap[result.reason] ?? 500 },
      )
    }

    // 7. Success
    return NextResponse.json({
      data:       result.data,
      tokensUsed: result.tokensUsed,
      latencyMs:  result.latencyMs,
      model:      result.model,
    })

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : `${capability} failed` },
      { status: 500 },
    )
  }
}

// ── Factory — use when the route needs no customisation ───────
export function makeAiRoute(capability: CapabilityName, allowedRoles: readonly string[] = AI_ROLES) {
  return async function POST(req: NextRequest) {
    return aiRoute(req, capability, allowedRoles)
  }
}

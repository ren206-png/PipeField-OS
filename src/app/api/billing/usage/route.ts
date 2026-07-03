// ============================================================
// GET /api/billing/usage
// Returns current org's plan, usage counts, and plan limits.
// ============================================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS } from '@/lib/plans'
import type { PlanKey } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const DEFAULT_PLAN: PlanKey = 'starter'

export async function GET() {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    const orgId = caller.organization_id
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── Fetch org to get plan ────────────────────────────────
    const { data: org } = await admin
      .from('organizations')
      .select('subscription_tier')
      .eq('id', orgId)
      .maybeSingle()

    // Map subscription_tier to a PlanKey. 'field_pro' and 'free_trial'
    // are treated as 'starter' for limit purposes.
    const tierRaw = org?.subscription_tier ?? 'starter'
    const planKey: PlanKey =
      tierRaw === 'pro' || tierRaw === 'enterprise'
        ? (tierRaw as PlanKey)
        : DEFAULT_PLAN

    // ── Count usage in parallel ──────────────────────────────
    const [projectsRes, usersRes, weldsRes] = await Promise.all([
      admin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
      admin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true),
      admin
        .from('welds')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
    ])

    const usage = {
      projects: projectsRes.count ?? 0,
      users:    usersRes.count    ?? 0,
      welds:    weldsRes.count    ?? 0,
    }

    const limits = PLANS[planKey].limits

    return NextResponse.json({
      plan:   planKey,
      usage,
      limits: {
        projects: limits.projects === Infinity ? null : limits.projects,
        users:    limits.users    === Infinity ? null : limits.users,
        welds:    limits.welds    === Infinity ? null : limits.welds,
      },
    })
  } catch (err) {
    console.error('[/api/billing/usage]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

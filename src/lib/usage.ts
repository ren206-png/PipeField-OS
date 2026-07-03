// ============================================================
// Server-side usage helpers
// Query counts against Supabase using the admin client so
// RLS never blocks the check.
// ============================================================
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanLimits, isWithinLimit } from '@/lib/plans'
import type { PlanKey } from '@/lib/plans'

const DEFAULT_PLAN: PlanKey = 'starter'

export interface OrgUsage {
  plan: PlanKey
  projectCount: number
  welderCount: number
  memberCount: number
  weldCount: number
  limits: ReturnType<typeof getPlanLimits>
}

export async function getOrgUsage(organizationId: string): Promise<OrgUsage> {
  const admin = createAdminClient()

  const [projectRes, welderRes, memberRes, weldRes, orgRes] = await Promise.all([
    admin
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    admin
      .from('welders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    admin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true),
    admin
      .from('welds')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    admin
      .from('organizations')
      .select('subscription_tier')
      .eq('id', organizationId)
      .maybeSingle(),
  ])

  const tierRaw = orgRes.data?.subscription_tier ?? DEFAULT_PLAN
  const plan: PlanKey =
    tierRaw === 'pro' || tierRaw === 'enterprise'
      ? (tierRaw as PlanKey)
      : DEFAULT_PLAN

  return {
    plan,
    projectCount: projectRes.count ?? 0,
    welderCount:  welderRes.count  ?? 0,
    memberCount:  memberRes.count  ?? 0,
    weldCount:    weldRes.count    ?? 0,
    limits:       getPlanLimits(plan),
  }
}

export async function checkProjectLimit(
  organizationId: string,
): Promise<{ allowed: boolean; current: number; limit: number; plan: PlanKey }> {
  const usage = await getOrgUsage(organizationId)
  const limit = usage.limits.projects as number
  return {
    allowed: isWithinLimit(usage.projectCount, limit),
    current: usage.projectCount,
    limit,
    plan: usage.plan,
  }
}

export async function checkWelderLimit(
  organizationId: string,
): Promise<{ allowed: boolean; current: number; limit: number; plan: PlanKey }> {
  const usage = await getOrgUsage(organizationId)
  const limit = usage.limits.users as number
  return {
    allowed: isWithinLimit(usage.welderCount, limit),
    current: usage.welderCount,
    limit,
    plan: usage.plan,
  }
}

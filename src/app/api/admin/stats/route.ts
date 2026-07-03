// ============================================================
// GET /api/admin/stats
// Platform-wide metrics for the developer admin dashboard.
// Platform admin only. Uses service role key (bypasses RLS).
// ============================================================
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requirePlatformAdmin()
    if (auth.error) return auth.error

    const admin = createAdminClient()
    const now   = new Date()
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const day7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()

    // Run all queries in parallel
    const [
      orgsResult,
      usersResult,
      newOrgs30Result,
      newOrgs7Result,
      newUsers30Result,
      newUsers7Result,
      tierBreakdownResult,
      recentOrgsResult,
      recentUsersResult,
    ] = await Promise.all([
      // Total orgs
      admin.from('organizations').select('id', { count: 'exact', head: true }),
      // Total users
      admin.from('user_profiles').select('id', { count: 'exact', head: true }),
      // New orgs last 30 days
      admin.from('organizations').select('id', { count: 'exact', head: true }).gte('created_at', day30),
      // New orgs last 7 days
      admin.from('organizations').select('id', { count: 'exact', head: true }).gte('created_at', day7),
      // New users last 30 days
      admin.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', day30),
      // New users last 7 days
      admin.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', day7),
      // Subscription tier breakdown
      admin.from('organizations').select('subscription_tier, subscription_status'),
      // Recent orgs (last 10)
      admin.from('organizations')
        .select('id, name, slug, subscription_tier, subscription_status, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      // Recent users (last 10)
      admin.from('user_profiles')
        .select('id, full_name, email, role, status, created_at, organizations(name)')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Build tier breakdown
    const tierCounts: Record<string, number> = {}
    const statusCounts: Record<string, number> = {}
    for (const org of tierBreakdownResult.data ?? []) {
      tierCounts[org.subscription_tier]   = (tierCounts[org.subscription_tier]   ?? 0) + 1
      statusCounts[org.subscription_status] = (statusCounts[org.subscription_status] ?? 0) + 1
    }

    return NextResponse.json({
      totals: {
        organizations: orgsResult.count  ?? 0,
        users:         usersResult.count ?? 0,
      },
      growth: {
        new_orgs_30d:  newOrgs30Result.count  ?? 0,
        new_orgs_7d:   newOrgs7Result.count   ?? 0,
        new_users_30d: newUsers30Result.count ?? 0,
        new_users_7d:  newUsers7Result.count  ?? 0,
      },
      tier_breakdown:   tierCounts,
      status_breakdown: statusCounts,
      recent_orgs:  recentOrgsResult.data  ?? [],
      recent_users: recentUsersResult.data ?? [],
    })
  } catch (err) {
    console.error('[/api/admin/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// GET /api/me
// Returns the current user's profile + organization.
// Fetched server-side via admin client so it bypasses any
// browser→Supabase REST latency issues.
// ============================================================
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', caller.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ profile: null, organization: null })
    }

    let organization = null
    if (profile.organization_id) {
      const { data: org } = await admin
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .maybeSingle()
      organization = org
    }

    return NextResponse.json({ profile, organization })
  } catch (err) {
    console.error('[/api/me]', err)
    return NextResponse.json({ profile: null, organization: null })
  }
}

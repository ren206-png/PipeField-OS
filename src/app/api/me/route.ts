// ============================================================
// GET /api/me
// Returns the current user's profile + organization.
// Accepts auth via:
//   1. Supabase session cookie (normal browser flow)
//   2. Authorization: Bearer <access_token> header (fallback for
//      timing races on sign-in before cookies are written)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient()
    let userId: string | null = null

    // ── Strategy 1: Bearer token from Authorization header ────
    const authHeader = req.headers.get('authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      // Verify the token against Supabase Auth
      const { data: { user }, error } = await admin.auth.getUser(token)
      if (!error && user) {
        userId = user.id
      }
    }

    if (!userId) {
      // ── Strategy 2: Session cookie (standard SSR flow) ──────
      const cookieStore = await cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                )
              } catch { /* Server Component context — ignore */ }
            },
          },
        }
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (user) userId = user.id
    }

    if (!userId) {
      console.warn('[/api/me] no userId resolved — returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Look up profile + org in ONE query ───────────────────
    // Embedding organizations(*) eliminates the second round-trip
    // and cuts cold-start latency by ~200-400 ms.
    const { data: row, error: profileError } = await admin
      .from('user_profiles')
      .select('*, organizations(*)')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('[/api/me] profile query error:', profileError)
    }

    if (!row) {
      console.warn('[/api/me] no profile found for userId:', userId)
      return NextResponse.json({ profile: null, organization: null })
    }

    // Separate the embedded org from the profile fields
    const { organizations: organization = null, ...profile } = row

    return NextResponse.json({ profile, organization })
  } catch (err) {
    console.error('[/api/me]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

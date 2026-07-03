// ============================================================
// PATCH /api/settings/email
// Changes the authenticated user's email address in both
// Supabase Auth (auth.users) and user_profiles.
//
// Restricted to platform_admin only — regular users cannot
// change their email through the app.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { z } from 'zod'

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
})

export async function PATCH(req: NextRequest) {
  try {
    // 1. Verify the caller is a platform_admin
    const { caller, error: authError } = await requirePlatformAdmin()
    if (authError) return authError

    // 2. Validate request body
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const { email: normalised } = parsed.data

    const admin = createAdminClient()

    // 3. Load current email to detect a no-op
    const { data: profile } = await admin
      .from('user_profiles')
      .select('id, email')
      .eq('auth_user_id', caller.auth_user_id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (normalised === profile.email) {
      return NextResponse.json({ error: 'That is already your current email.' }, { status: 400 })
    }

    // 4. Update in Supabase Auth (auth.users table)
    const { error: updateAuthError } = await admin.auth.admin.updateUserById(
      caller.auth_user_id,
      { email: normalised }
    )

    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message }, { status: 500 })
    }

    // 5. Update in user_profiles
    const { error: profileError } = await admin
      .from('user_profiles')
      .update({ email: normalised, updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    if (profileError) {
      // Auth email was changed but profile wasn't — log it, still return success
      // (the auth record is the source of truth; profile will sync on next login)
      console.error('[/api/settings/email] profile update failed:', profileError.message)
    }

    return NextResponse.json({ success: true, email: normalised })
  } catch (err) {
    console.error('[/api/settings/email]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// POST /api/onboarding/complete
// Marks the authenticated user's onboarding as completed.
// Idempotent — safe to call multiple times.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  const admin = createAdminClient()

  const { error } = await admin
    .from('user_profiles')
    .update({ onboarding_completed: true })
    .eq('auth_user_id', caller.auth_user_id)

  if (error) {
    console.error('onboarding/complete error:', error)
    return NextResponse.json({ error: 'Failed to mark onboarding complete' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

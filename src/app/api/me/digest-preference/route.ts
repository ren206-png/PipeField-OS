// ============================================================
// PATCH /api/me/digest-preference
// Updates the authenticated user's email digest frequency.
// Values: 'daily' | 'weekly' | 'none'
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  frequency: z.enum(['daily', 'weekly', 'none']),
})

export async function PATCH(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'frequency must be daily, weekly, or none' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('user_profiles')
    .update({ digest_frequency: parsed.data.frequency })
    .eq('auth_user_id', caller.auth_user_id)

  if (error) {
    console.error('digest-preference update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, frequency: parsed.data.frequency })
}

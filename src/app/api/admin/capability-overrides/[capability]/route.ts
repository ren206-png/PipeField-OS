// ============================================================
// PATCH /api/admin/capability-overrides/[capability]
// Re-enables a capability that was auto-disabled.
// Platform admin only.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePlatformAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
) {
  void req
  try {
    const authResult = await requirePlatformAdmin()
    if (authResult.error) return authResult.error

    const { capability } = await params

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('capability_overrides')
      .update({
        disabled:      false,
        re_enabled_at: new Date().toISOString(),
        auto_disabled: false,
      })
      .eq('capability', capability)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, capability })
  } catch (err) {
    console.error('[/api/admin/capability-overrides PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

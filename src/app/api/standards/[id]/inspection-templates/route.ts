// GET /api/standards/[id]/inspection-templates — list inspection templates for a standard
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error: authError } = await requireAuth(req)
    if (authError) return authError

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('inspection_templates')
      .select('*')
      .eq('standard_id', params.id)

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/standards/[id]/inspection-templates]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

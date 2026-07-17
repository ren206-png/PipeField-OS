// ============================================================
// GET /api/nde/profiles — list code profiles for org
// POST /api/nde/profiles — create a code profile
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NDE_ENGINE_ENABLED } from '@/intelligence/flags'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  profile_name:              z.string().min(1).max(200),
  sampling_pct_rt:           z.number().min(0).max(100),
  sampling_pct_ut:           z.number().min(0).max(100),
  progressive_trigger_count: z.number().int().min(1),
  progressive_add_pct:       z.number().min(0).max(100),
  acceptance_standard:       z.string().min(1).max(50),
})

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!NDE_ENGINE_ENABLED) {
      return NextResponse.json({ error: 'NDE Engine is not enabled' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('nde_code_profiles')
      .select('*')
      .eq('organization_id', caller.organization_id!)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/nde/profiles]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!NDE_ENGINE_ENABLED) {
      return NextResponse.json({ error: 'NDE Engine is not enabled' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('nde_code_profiles')
      .insert({
        organization_id:           caller.organization_id!,
        profile_name:              parsed.data.profile_name,
        sampling_pct_rt:           parsed.data.sampling_pct_rt,
        sampling_pct_ut:           parsed.data.sampling_pct_ut,
        progressive_trigger_count: parsed.data.progressive_trigger_count,
        progressive_add_pct:       parsed.data.progressive_add_pct,
        acceptance_standard:       parsed.data.acceptance_standard,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[POST /api/nde/profiles]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

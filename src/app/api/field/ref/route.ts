// ============================================================
// Field Mode — Reference Data API Route
// Server-side proxy that fetches read-only engineering reference
// tables using the service role key (bypasses RLS).
//
// Reference data is static engineering tables (ASME dimensions etc.)
// with no per-tenant data — safe to serve to any authenticated user.
//
// GET /api/field/ref?table=ref_bw_fittings&nps=1/2&fitting_type=90%25+LR
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Allowlist — prevents arbitrary table access
const ALLOWED_TABLES = new Set([
  'ref_bw_fittings',
  'ref_sw_fittings',
  'ref_sw_couplings',
  'ref_threaded_fittings',
  'ref_npt_threads',
  'ref_flanges',
  'ref_flange_hubs',
  'ref_flange_weights',
  'ref_stud_bolts',
  'ref_wrench_sizes',
  'ref_reducing_tee_outlets',
  'ref_shackles',
  'ref_sling_leg_factors',
  'ref_snatch_block_factors',
  'ref_wire_rope_slings',
  'ref_synthetic_slings',
  'ref_chain_slings',
  'ref_material_weights',
  'ref_plate_steel_weights',
])

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth.error) return auth.error

  const { searchParams } = req.nextUrl
  const table = searchParams.get('table')

  if (!table || !ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  // Build filters from remaining query params (exclude 'table')
  const filters: Record<string, string> = {}
  searchParams.forEach((v, k) => { if (k !== 'table') filters[k] = v })

  // Build query using raw REST to avoid TypeScript deep-type issues
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(table).select('*').neq('rejected', true)

  // Apply equality filters
  for (const [col, val] of Object.entries(filters)) {
    q = q.eq(col, val)
  }

  const { data, error } = await q

  if (error) {
    console.error('[field/ref] query error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

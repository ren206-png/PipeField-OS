// ============================================================
// Field Mode — Verify Reference Row API Route
// Only platform_admin can verify.
// Uses caller's session (anon client) — RLS on ref tables
// allows only platform_admin writes.
// NO createAdminClient here.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'

const VerifySchema = z.object({
  table_name:      z.string().min(1),
  row_ids:         z.array(z.string().uuid()).min(1).max(100),
  verified:        z.boolean(),
  verified_against:z.string().min(1).max(500).optional(),
  note:            z.string().max(500).optional(),
  reject:          z.boolean().optional(),
})

// Allowlist of valid ref tables — prevents SQL injection via table_name
const VALID_REF_TABLES = new Set([
  'ref_flanges', 'ref_flange_hubs', 'ref_flange_weights', 'ref_stud_bolts',
  'ref_bw_fittings', 'ref_reducing_tee_outlets', 'ref_sw_fittings', 'ref_sw_couplings',
  'ref_threaded_fittings', 'ref_npt_threads', 'ref_wrench_sizes',
  'ref_shackles', 'ref_sling_leg_factors', 'ref_snatch_block_factors',
  'ref_wire_rope_slings', 'ref_synthetic_slings', 'ref_chain_slings',
  'ref_material_weights', 'ref_plate_steel_weights',
  'ref_hand_signals', 'ref_conversion_factors', 'ref_eye_bolts', 'ref_wire_rope_clips',
  'ref_hydro_test_pressures', 'ref_pancake_thickness', 'ref_valve_face_to_face',
  'ref_abbreviations', 'ref_formulas', 'ref_gas_properties', 'ref_water_head_pressure',
  'ref_bolt_drill_tap',
])

export async function POST(req: NextRequest) {
  // 1. Auth — requireAuth uses caller's session (no admin client)
  const auth = await requireAuth(req)
  if (auth.error) return auth.error

  // 2. Role check — platform_admin only
  if (auth.caller.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden — platform_admin only' }, { status: 403 })
  }

  // 3. Parse body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation error' }, { status: 400 })
  }

  const { table_name, row_ids, verified, verified_against, note, reject } = parsed.data

  // 4. Validate table name against allowlist
  if (!VALID_REF_TABLES.has(table_name)) {
    return NextResponse.json({ error: `Unknown table: ${table_name}` }, { status: 400 })
  }

  // 5. Build anon Supabase client with caller's session
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
          } catch { /* Server Components can't set cookies */ }
        },
      },
    }
  )

  const now = new Date().toISOString()
  let updated = 0

  // 6. Update rows and insert verification events
  for (const row_id of row_ids) {
    // Update the ref table row
    const refUpdate: Record<string, unknown> = {
      verified: !reject,
      verified_by:      auth.caller.id,
      verified_against: verified_against ?? null,
      verified_at:      now,
    }
    if (reject) {
      refUpdate.rejected      = true
      refUpdate.rejected_note = note ?? null
    }

    const { error: updateError } = await supabase
      .from(table_name)
      .update(refUpdate)
      .eq('id', row_id)

    if (updateError) continue

    // Insert into ref_verification_events (if table exists)
    await supabase.from('ref_verification_events').insert({
      ref_table:        table_name,
      ref_row_id:       row_id,
      verified:         !reject,
      verified_by:      auth.caller.id,
      verified_against: verified_against ?? null,
      note:             note ?? null,
      reject:           reject ?? false,
      created_at:       now,
    })

    updated++
  }

  return NextResponse.json({ updated })
}

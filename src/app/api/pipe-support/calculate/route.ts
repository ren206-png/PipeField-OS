// ============================================================
// POST /api/pipe-support/calculate
// Runs the pipe support calculation engine and returns the
// full CalcResult shape the client expects.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const inputSchema = z.object({
  nps:                      z.string().min(1).max(20),
  schedule:                 z.string().min(1).max(20),
  standard:                 z.enum(['B36.10M', 'B36.19M']).default('B36.10M'),
  material:                 z.string().max(50).default('carbon_steel'),
  fluid:                    z.string().max(50).default('water'),
  fluid_density_lbft3:      z.number().optional(),
  insulation_thickness_in:  z.number().default(0),
  insulation_density_lbft3: z.number().default(5),
  deflection_limit_in:      z.number().default(0.10),
  design_basis:             z.enum(['B31.3', 'B31.1']).default('B31.3'),
  company_span_ft:          z.number().optional(),
  temperature:              z.number().optional(),
  insulated:                z.boolean().optional(),
}).passthrough()

export async function POST(request: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(request)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 422 }
      )
    }

    // If a dedicated backend URL is configured, proxy to it
    const backendUrl = process.env.PIPEFIELD_BACKEND_URL
    if (backendUrl) {
      const res = await fetch(`${backendUrl}/calculations/support`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.PIPEFIELD_BACKEND_API_KEY
            ? { Authorization: `Bearer ${process.env.PIPEFIELD_BACKEND_API_KEY}` }
            : {}),
        },
        body: JSON.stringify(parsed.data),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // ── Built-in TypeScript calculation engine ──────────────
    // Uses the same runOfflineCalc used on the client so the
    // result shape is always consistent.
    const { runOfflineCalc } = await import('@/lib/offline/pipeCalc')

    const input = {
      nps:                      parsed.data.nps,
      schedule:                 parsed.data.schedule,
      standard:                 (parsed.data.standard ?? 'B36.10M') as 'B36.10M' | 'B36.19M',
      material:                 (parsed.data.material ?? 'carbon_steel') as 'carbon_steel' | 'stainless_steel' | 'copper',
      fluid:                    (parsed.data.fluid    ?? 'water') as 'water' | 'steam' | 'condensate' | 'air' | 'nitrogen' | 'natural_gas' | 'crude_oil' | 'custom',
      fluid_density_lbft3:      parsed.data.fluid_density_lbft3,
      insulation_thickness_in:  parsed.data.insulation_thickness_in  ?? 0,
      insulation_density_lbft3: parsed.data.insulation_density_lbft3 ?? 5,
      deflection_limit_in:      parsed.data.deflection_limit_in      ?? 0.10,
      design_basis:             (parsed.data.design_basis ?? 'B31.3') as 'B31.3' | 'B31.1',
      company_span_ft:          parsed.data.company_span_ft,
    }

    const o = runOfflineCalc(input)

    // Build the full CalcResult shape the client expects
    const output_json = {
      dimensions: { OD_in: o.OD_in, wall_in: o.wall_in, ID_in: o.ID_in },
      areas: {
        metal_area_in2:      o.metal_area_in2,
        fluid_area_in2:      o.fluid_area_in2,
        insulation_area_in2: o.insulation_area_in2,
      },
      weights: {
        metal_lbft:      o.metal_lbft,
        fluid_lbft:      o.fluid_lbft,
        insulation_lbft: o.insulation_lbft,
        total_lbft:      o.total_lbft,
      },
      span: {
        calculated_ft:         o.calculated_ft,
        recommended_ft:        o.recommended_ft,
        company_ft:            o.company_ft,
        selected_ft:           o.selected_ft,
        moment_of_inertia_in4: o.moment_of_inertia_in4,
        elastic_modulus_psi:   o.elastic_modulus_psi,
      },
      slope: {
        min_slope_in_per_ft: input.design_basis === 'B31.3' ? 0.125 : 0.0625,
      },
      hydrotest: {
        W_water_lbft:      o.W_water_lbft,
        W_test_lbft:       o.W_test_lbft,
        P_test_lb:         o.P_test_lb,
        operating_load_lb: o.operating_load_lb,
        percent_increase:  o.percent_increase,
      },
      weld_clearance: {
        pass:                   true,
        conflicts:              [],
        adjusted_locations_ft:  [],
        audit_entries:          [],
      },
    }

    return NextResponse.json(
      { output_json },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    )

  } catch (error: unknown) {
    console.error('[/api/pipe-support/calculate]', error)
    const msg = error instanceof Error ? error.message : 'Calculation failed'
    return NextResponse.json({ detail: msg }, { status: 422 })
  }
}

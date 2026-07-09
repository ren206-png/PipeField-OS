// ============================================================
// POST /api/pipe-support/calculate
// Runs the pipe support calculation engine in TypeScript.
// The previous execSync/Python path was removed — it was an
// unauthenticated RCE vector (user input injected into shell).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const inputSchema = z.object({
  nps:         z.string().min(1).max(20),
  schedule:    z.string().min(1).max(20),
  fluid:       z.string().max(50).optional().default('water'),
  temperature: z.number().optional(),
  insulated:   z.boolean().optional().default(false),
  span_ft:     z.number().positive().optional(),
  material:    z.string().max(50).optional().default('carbon_steel'),
}).passthrough()

export async function POST(request: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(request)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await request.json()

    // Validate input
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 422 }
      )
    }

    // If a dedicated backend URL is configured, proxy to it (server-to-server only)
    const backendUrl = process.env.PIPEFIELD_BACKEND_URL
    if (backendUrl) {
      const res = await fetch(`${backendUrl}/calculations/support`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // Use a server-side API key, never forward the client's auth token
        ...(process.env.PIPEFIELD_BACKEND_API_KEY
          ? { Authorization: `Bearer ${process.env.PIPEFIELD_BACKEND_API_KEY}` }
          : {}),
        body: JSON.stringify(parsed.data),
      })
      const data = await res.json()
      return NextResponse.json(data, { status: res.status })
    }

    // TypeScript calculation engine — no child_process, no shell injection possible
    const { calcSupportSpan, calcHangerLoad } = await import('@/lib/calculator/pipe-support-calcs')

    // Use conservative defaults — the front-end can pass pre-computed pipe properties
    // for a more accurate result via the PIPEFIELD_BACKEND_URL path
    const OD_in    = (parsed.data as Record<string, number>).OD_in    ?? 4.5
    const wall_in  = (parsed.data as Record<string, number>).wall_in  ?? 0.237
    const metalLbft = (parsed.data as Record<string, number>).metal_lbft ?? 10
    const totalLbft = metalLbft + (parsed.data.insulated ? metalLbft * 0.15 : 0)

    const spanResult   = calcSupportSpan({
      OD_in,
      wall_in,
      total_lbft:  totalLbft,
      material:    parsed.data.material ?? 'carbon_steel',
      nps:         parsed.data.nps,
    })
    const hangerResult = calcHangerLoad({ total_lbft: totalLbft, span_ft: spanResult.selected_ft })

    return NextResponse.json(
      {
        output_json: {
          span:   spanResult,
          hanger: hangerResult,
          inputs: parsed.data,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    )

  } catch (error: unknown) {
    console.error('[/api/pipe-support/calculate]', error)
    const msg = error instanceof Error ? error.message : 'Calculation failed'
    return NextResponse.json({ detail: msg }, { status: 422 })
  }
}

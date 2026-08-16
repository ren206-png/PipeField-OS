// ============================================================
// GET /api/pipe-dimensions
// Serve ASME pipe dimensions with optional SI conversion.
//
// Query params:
//   standard  — 'B36.10M' | 'B36.19M'  (default: B36.10M)
//   nps       — NPS size string, e.g. '4' or '4.0'
//   schedule  — Schedule string, e.g. 'SCH40'
//   units     — 'imperial' | 'si'        (default: imperial)
//
// Returns all schedules for a given NPS if schedule is omitted.
// Returns all NPS sizes if both nps and schedule are omitted.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { inToMm, npsToDn } from '@/lib/units'
import pipeDimensions from '@/data/asme_pipe_dimensions.json'

export const dynamic = 'force-dynamic'

type DimData = Record<string, {
  OD_in: number
  schedules: Record<string, { wall_in: number; ID_in: number }>
}>

type StandardData = Record<string, DimData>

const DATA = pipeDimensions as unknown as StandardData

function toSI(nps: string, od_in: number, wall_in: number, id_in: number) {
  return {
    OD_mm:   inToMm(od_in),
    wall_mm: inToMm(wall_in),
    ID_mm:   inToMm(id_in),
    DN_mm:   npsToDn(nps),
    unit_system: 'si' as const,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth(req)
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const standard = searchParams.get('standard') ?? 'B36.10M'
    const nps      = searchParams.get('nps')
    const schedule = searchParams.get('schedule')
    const units    = searchParams.get('units') ?? 'imperial'

    const stdData = DATA[standard]
    if (!stdData) {
      return NextResponse.json(
        { error: `Unknown standard "${standard}". Valid: ${Object.keys(DATA).join(', ')}` },
        { status: 400 }
      )
    }

    // ── All NPS sizes (no nps param) ──────────────────────────
    if (!nps) {
      const result = Object.entries(stdData).map(([npsKey, npsData]) => ({
        nps: npsKey,
        OD_in: npsData.OD_in,
        ...(units === 'si' ? { OD_mm: inToMm(npsData.OD_in), DN_mm: npsToDn(npsKey) } : {}),
        schedules: Object.keys(npsData.schedules),
      }))
      return NextResponse.json({ standard, unit_system: units, sizes: result })
    }

    const npsData = stdData[nps]
    if (!npsData) {
      return NextResponse.json(
        { error: `NPS "${nps}" not found in ${standard}` },
        { status: 404 }
      )
    }

    // ── All schedules for an NPS ──────────────────────────────
    if (!schedule) {
      const schedules = Object.entries(npsData.schedules).map(([sch, dim]) => ({
        schedule: sch,
        ...(units === 'si'
          ? toSI(nps, npsData.OD_in, dim.wall_in, dim.ID_in)
          : { OD_in: npsData.OD_in, wall_in: dim.wall_in, ID_in: dim.ID_in, unit_system: 'imperial' }),
      }))
      return NextResponse.json({ standard, nps, schedules })
    }

    // ── Specific schedule ─────────────────────────────────────
    const dim = npsData.schedules[schedule]
    if (!dim) {
      return NextResponse.json(
        { error: `Schedule "${schedule}" not found for NPS ${nps} in ${standard}` },
        { status: 404 }
      )
    }

    if (units === 'si') {
      return NextResponse.json({
        standard, nps, schedule,
        ...toSI(nps, npsData.OD_in, dim.wall_in, dim.ID_in),
      })
    }

    return NextResponse.json({
      standard, nps, schedule,
      OD_in:   npsData.OD_in,
      wall_in: dim.wall_in,
      ID_in:   dim.ID_in,
      unit_system: 'imperial',
    })
  } catch (err) {
    console.error('[GET /api/pipe-dimensions]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

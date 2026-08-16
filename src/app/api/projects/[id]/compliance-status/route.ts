// GET /api/projects/[id]/compliance-status — compliance summary for a project
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const admin = createAdminClient()
    const projectId = params.id

    // Verify project belongs to caller's org
    const { data: project } = await admin
      .from('projects')
      .select('id, governing_code')
      .eq('id', projectId)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 1. Count total welds for the project
    let totalWelds: number | null = null
    try {
      const { count } = await admin
        .from('welds')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('organization_id', caller.organization_id)
      totalWelds = count ?? 0
    } catch (_) { /* return null for this stat */ }

    // 2. Count weld_inspections (pass vs total) for this project's welds
    let weldsWithVisualInspection: number | null = null
    let weldsWithNdt: number | null = null
    let inspectionCompletionPct: number | null = null
    try {
      const { data: inspections } = await admin
        .from('weld_inspections')
        .select('weld_id, inspection_type, pass_fail')
        .eq('organization_id', caller.organization_id)
        .in(
          'weld_id',
          await admin
            .from('welds')
            .select('id')
            .eq('project_id', projectId)
            .eq('organization_id', caller.organization_id)
            .then(({ data }) => (data ?? []).map((w: { id: string }) => w.id))
        )

      if (inspections) {
        const visualWeldIds = new Set(
          inspections
            .filter((i) => i.inspection_type === 'VISUAL')
            .map((i) => i.weld_id)
        )
        const ndtWeldIds = new Set(
          inspections
            .filter((i) =>
              ['RADIOGRAPHIC', 'ULTRASONIC', 'MAGNETIC_PARTICLE'].includes(i.inspection_type)
            )
            .map((i) => i.weld_id)
        )
        weldsWithVisualInspection = visualWeldIds.size
        weldsWithNdt = ndtWeldIds.size
        inspectionCompletionPct =
          totalWelds && totalWelds > 0
            ? Math.round((visualWeldIds.size / totalWelds) * 100)
            : 0
      }
    } catch (_) { /* return nulls */ }

    // 3. Count weld_qualifications for org members (ACTIVE vs total)
    let welderQualificationsActive: number | null = null
    let welderQualificationsTotal: number | null = null
    try {
      const { data: quals } = await admin
        .from('weld_qualifications')
        .select('id, status')
        .eq('organization_id', caller.organization_id)

      if (quals) {
        welderQualificationsTotal = quals.length
        welderQualificationsActive = quals.filter((q) => q.status === 'ACTIVE').length
      }
    } catch (_) { /* return nulls */ }

    // 4. Get continuity alerts (CLOSE_TO_EXPIRY or EXPIRED)
    let continuityAlerts: Array<{
      welder_id: string
      process: string
      position: string
      expires_date: string
      continuity_status: string
    }> = []
    try {
      const { data: continuity } = await admin
        .from('welder_continuity')
        .select('welder_id, process, position, expires_date, continuity_status')
        .eq('organization_id', caller.organization_id)
        .in('continuity_status', ['CLOSE_TO_EXPIRY', 'EXPIRED'])

      continuityAlerts = continuity ?? []
    } catch (_) { /* return empty array */ }

    // 5. Get standard name from compliance_standards via project's governing_code
    let standard: string | null = null
    try {
      if (project.governing_code) {
        const { data: codeEntry } = await admin
          .from('code_registry')
          .select('standard_name')
          .eq('id', project.governing_code)
          .maybeSingle()

        if (codeEntry?.standard_name) {
          const { data: complianceStandard } = await admin
            .from('compliance_standards')
            .select('standard_name')
            .eq('standard_name', codeEntry.standard_name)
            .maybeSingle()

          standard = complianceStandard?.standard_name ?? codeEntry.standard_name ?? null
        }
      }
    } catch (_) { /* return null */ }

    return NextResponse.json({
      project_id: projectId,
      standard,
      total_welds: totalWelds,
      welds_with_visual_inspection: weldsWithVisualInspection,
      welds_with_ndt: weldsWithNdt,
      inspection_completion_pct: inspectionCompletionPct,
      welder_qualifications_active: welderQualificationsActive,
      welder_qualifications_total: welderQualificationsTotal,
      continuity_alerts: continuityAlerts,
    })
  } catch (err) {
    console.error('[GET /api/projects/[id]/compliance-status]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/welds — create a new weld
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { isFlagEnabled } from '@/intelligence/flags'
import { checkQualification } from '@/intelligence/engines/qualification-engine'
import { writeWeldEvent } from '@/lib/weld-events'

export const dynamic = 'force-dynamic'

const schema = z.object({
  project_id:          z.string().uuid(),
  weld_id_number:      z.string().min(1).max(50),
  welder_stamp:        z.string().max(10).optional().nullable(),
  welder_name:         z.string().max(100).optional().nullable(),
  status:              z.string().optional().default('not_welded'),
  weld_date:           z.string().optional().nullable(),
  notes:               z.string().max(1000).optional().nullable(),
  // Module 3: Material Traceability (accepted when MATERIAL_TRACE flag is ON)
  base_metal_heat_a:   z.string().max(100).optional().nullable(),
  base_metal_heat_b:   z.string().max(100).optional().nullable(),
  filler_batch_number: z.string().max(100).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify project belongs to caller's org
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id')
    .eq('id', parsed.data.project_id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('welds')
    .insert({
      ...parsed.data,
      organization_id: caller.organization_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const newWeld = data

  // ── Module 1: Qualification Enforcement ──────────────────────
  if (isFlagEnabled('PFOS_QUAL_ENFORCEMENT') && newWeld) {
    const qualResult = await checkQualification({
      weldId:         newWeld.id as string,
      welderId:       (newWeld.welder_id as string | null) ?? null,
      welderStamp:    (newWeld.welder_stamp as string | null) ?? null,
      wpsId:          (newWeld.wps_id as string | null) ?? null,
      organizationId: caller.organization_id,
    })

    if (!qualResult.qualified || !qualResult.continuityOk) {
      const admin2 = createAdminClient()
      const { data: settings } = await admin2
        .from('org_settings')
        .select('qual_enforcement_mode')
        .eq('organization_id', caller.organization_id)
        .maybeSingle()

      const mode = (settings as { qual_enforcement_mode?: string } | null)?.qual_enforcement_mode ?? 'FLAG'

      if (mode === 'HARD_BLOCK') {
        // NOTE: this event is cascade-deleted with the weld. Consider a blocked_weld_attempts
        // table in a future migration for full audit trail.
        await writeWeldEvent({
          organizationId: caller.organization_id,
          weldId:         newWeld.id as string,
          eventType:      'qual_blocked',
          actorId:        caller.id,
          actorRole:      caller.role ?? 'unknown',
          reason:         qualResult.qualReason,
          metadata:       { qualResult },
        })
        // Delete the weld we just created (cascade-deletes the event above)
        await admin2.from('welds').delete().eq('id', newWeld.id as string)
        return NextResponse.json({
          error:           qualResult.qualReason,
          blocked:         true,
          engineeringNote: qualResult.engineeringNote,
        }, { status: 422 })
      }

      // FLAG mode: weld stays, gets flagged
      await admin2.from('welds').update({
        qualification_flag: qualResult.qualified
          ? `Continuity warning: ${qualResult.continuityReason}`
          : qualResult.qualReason,
      }).eq('id', newWeld.id as string)

      await writeWeldEvent({
        organizationId: caller.organization_id,
        weldId:         newWeld.id as string,
        eventType:      qualResult.qualified ? 'continuity_flagged' : 'qual_flagged',
        actorId:        caller.id,
        actorRole:      caller.role ?? 'unknown',
        reason:         qualResult.qualReason,
        metadata:       { qualResult },
      })
    } else {
      // All checks passed
      await writeWeldEvent({
        organizationId: caller.organization_id,
        weldId:         newWeld.id as string,
        eventType:      'qual_passed',
        actorId:        caller.id,
        actorRole:      caller.role ?? 'unknown',
        reason:         'Welder qualified and continuity current.',
        metadata:       { certId: qualResult.certId },
      })
    }
  }

  return NextResponse.json(newWeld, { status: 201 })
}

// Shared weld creation — used by POST /api/welds and the offline sync queue
// so both apply the same field allowlist, approval-role check and
// qualification enforcement (SEC-003).
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFlagEnabled } from '@/intelligence/flags'
import { checkQualification } from '@/intelligence/engines/qualification-engine'
import { writeWeldEvent } from '@/lib/weld-events'
import { hasPermission, isWeldApprovalStatus } from '@/lib/auth/permissions'
import type { CallerProfile } from '@/lib/api-auth'
import type { UserRole } from '@/types'

export const weldCreateSchema = z.object({
  project_id:          z.string().uuid(),
  weld_id_number:      z.string().min(1).max(50),
  welder_stamp:        z.string().max(10).optional().nullable(),
  welder_name:         z.string().max(100).optional().nullable(),
  status:              z.string().optional().default('not_welded'),
  weld_date:           z.string().optional().nullable(),
  notes:               z.string().max(1000).optional().nullable(),
  joint_type:          z.string().max(50).optional().nullable(),
  process:             z.string().max(50).optional().nullable(),
  // Module 3: Material Traceability (accepted when MATERIAL_TRACE flag is ON)
  base_metal_heat_a:   z.string().max(100).optional().nullable(),
  base_metal_heat_b:   z.string().max(100).optional().nullable(),
  filler_batch_number: z.string().max(100).optional().nullable(),
}).strip()

export type WeldCreateInput = z.infer<typeof weldCreateSchema>

export type CreateWeldResult =
  | { ok: true;  weld: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> }

export async function createWeld(
  caller: CallerProfile & { organization_id: string },
  input: WeldCreateInput,
): Promise<CreateWeldResult> {
  if (isWeldApprovalStatus(input.status) && !hasPermission(caller.role as UserRole, 'welds:approve')) {
    return { ok: false, status: 403, body: { error: 'Your role cannot create a weld with an approval status' } }
  }
  const parsed = { data: input }
  const admin = createAdminClient()

  // Verify project belongs to caller's org
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id')
    .eq('id', parsed.data.project_id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (projectError) return { ok: false, status: 500, body: { error: projectError.message } }
  if (!project) {
    return { ok: false, status: 404, body: { error: 'Project not found' } }
  }

  const { data, error } = await admin
    .from('welds')
    .insert({
      ...parsed.data,
      organization_id: caller.organization_id,
    })
    .select()
    .single()

  if (error) return { ok: false, status: 400, body: { error: error.message } }

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
        return { ok: false, status: 422, body: {
          error:           qualResult.qualReason,
          blocked:         true,
          engineeringNote: qualResult.engineeringNote,
        } }
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

  return { ok: true, weld: newWeld as Record<string, unknown> }
}

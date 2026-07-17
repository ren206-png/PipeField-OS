// ============================================================
// PATCH /api/nde/selections/[id]/result
// Record an inspection result (pass/fail) on a selection.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NDE_ENGINE_ENABLED } from '@/intelligence/flags'
import { writeWeldEvent } from '@/lib/weld-events'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  result:       z.enum(['pass', 'fail']),
  result_notes: z.string().max(2000).optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: selectionId } = await params
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!NDE_ENGINE_ENABLED) {
      return NextResponse.json({ error: 'NDE Engine is not enabled' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // ── Load selection ───────────────────────────────────────
    const { data: selection, error: selErr } = await admin
      .from('nde_selections')
      .select('*')
      .eq('id', selectionId)
      .eq('organization_id', caller.organization_id!)
      .single()

    if (selErr || !selection) {
      return NextResponse.json({ error: 'Selection not found' }, { status: 404 })
    }

    // ── Update result ────────────────────────────────────────
    const { data: updated, error: updateErr } = await admin
      .from('nde_selections')
      .update({
        result:       parsed.data.result,
        result_notes: parsed.data.result_notes ?? null,
        result_at:    new Date().toISOString(),
      })
      .eq('id', selectionId)
      .eq('organization_id', caller.organization_id!)
      .select('*')
      .single()

    if (updateErr) throw updateErr

    // ── Write weld event ─────────────────────────────────────
    const eventType = parsed.data.result === 'pass' ? 'nde_result_pass' : 'nde_result_fail'

    await writeWeldEvent({
      organizationId: caller.organization_id!,
      weldId:         selection.weld_id,
      eventType,
      actorId:        caller.id,
      actorRole:      caller.role,
      metadata: {
        nde_plan_id:     selection.nde_plan_id,
        selection_id:    selectionId,
        inspection_type: selection.inspection_type,
        result_notes:    parsed.data.result_notes ?? null,
      },
    })

    // ── Progressive penalty check on fail ───────────────────
    if (parsed.data.result === 'fail') {
      // Count total fails in this plan
      const { count: failCount } = await admin
        .from('nde_selections')
        .select('id', { count: 'exact', head: true })
        .eq('nde_plan_id', selection.nde_plan_id)
        .eq('organization_id', caller.organization_id!)
        .eq('result', 'fail')

      // Load the plan's code profile to get progressive_trigger_count
      const { data: planRow } = await admin
        .from('nde_plans')
        .select('code_profile:nde_code_profiles(progressive_trigger_count), project_id')
        .eq('id', selection.nde_plan_id)
        .single()

      const profileData = planRow?.code_profile as { progressive_trigger_count: number } | null | undefined
      const threshold = profileData?.progressive_trigger_count ?? null

      if (threshold !== null && failCount !== null && failCount >= threshold) {
        // Write progressive penalty event on the plan using a sentinel weld_id
        // We use the failing weld itself as the anchor
        await writeWeldEvent({
          organizationId: caller.organization_id!,
          weldId:         selection.weld_id,
          eventType:      'nde_progressive_penalty',
          actorId:        caller.id,
          actorRole:      caller.role,
          metadata: {
            nde_plan_id: selection.nde_plan_id,
            fail_count:  failCount,
            threshold,
          },
        })
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/nde/selections/[id]/result]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

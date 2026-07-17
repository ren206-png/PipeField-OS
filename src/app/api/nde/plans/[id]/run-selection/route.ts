// ============================================================
// POST /api/nde/plans/[id]/run-selection
// Run deterministic NDE weld selection for an existing plan.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NDE_ENGINE_ENABLED } from '@/intelligence/flags'
import { runNdeSelection } from '@/intelligence/engines/nde-selection-engine'
import { writeWeldEvent } from '@/lib/weld-events'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!NDE_ENGINE_ENABLED) {
      return NextResponse.json({ error: 'NDE Engine is not enabled' }, { status: 403 })
    }

    const admin = createAdminClient()

    // ── Load plan ────────────────────────────────────────────
    const { data: plan, error: planErr } = await admin
      .from('nde_plans')
      .select('*, code_profile:nde_code_profiles(*)')
      .eq('id', planId)
      .eq('organization_id', caller.organization_id!)
      .single()

    if (planErr || !plan) {
      return NextResponse.json({ error: 'NDE plan not found' }, { status: 404 })
    }

    const profile = plan.code_profile as {
      sampling_pct_rt: number
      sampling_pct_ut: number
      progressive_trigger_count: number
      progressive_add_pct: number
    }

    // ── Load eligible welds (accepted, not yet in this plan) ─
    const { data: selectedWeldRows } = await admin
      .from('nde_selections')
      .select('weld_id')
      .eq('nde_plan_id', planId)
      .eq('organization_id', caller.organization_id!)

    const alreadySelected = new Set((selectedWeldRows ?? []).map(r => r.weld_id))

    const { data: welds, error: weldsErr } = await admin
      .from('welds')
      .select('id')
      .eq('project_id', plan.project_id)
      .eq('organization_id', caller.organization_id!)
      .eq('status', 'accepted')

    if (weldsErr) throw weldsErr

    const eligibleWeldIds = (welds ?? [])
      .map(w => w.id)
      .filter(id => !alreadySelected.has(id))

    if (eligibleWeldIds.length === 0) {
      return NextResponse.json({
        selections_created: 0,
        seed: null,
        engineering_note: 'No eligible welds found (accepted status, not already selected).',
      })
    }

    // ── Load prior fails for progressive penalty ─────────────
    const { data: failRows } = await admin
      .from('nde_selections')
      .select('weld_id')
      .eq('nde_plan_id', planId)
      .eq('organization_id', caller.organization_id!)
      .eq('result', 'fail')

    const priorFailWeldIds = (failRows ?? []).map(r => r.weld_id)

    // ── Run selection for RT and UT ──────────────────────────
    const typesToRun: Array<{ type: 'RT' | 'UT'; pct: number }> = (
      [
        { type: 'RT' as const, pct: Number(profile.sampling_pct_rt) },
        { type: 'UT' as const, pct: Number(profile.sampling_pct_ut) },
      ] as Array<{ type: 'RT' | 'UT'; pct: number }>
    ).filter(t => t.pct > 0)

    let totalCreated = 0
    let lastSeed: string | null = null
    let lastEngNote: string | null = null

    for (const { type, pct } of typesToRun) {
      const result = await runNdeSelection({
        nde_plan_id:               planId,
        organization_id:           caller.organization_id!,
        weld_ids:                  eligibleWeldIds,
        inspection_type:           type,
        sampling_pct:              pct,              // ENGINEERING_REVIEW_REQUIRED
        progressive_trigger_count: Number(profile.progressive_trigger_count), // ENGINEERING_REVIEW_REQUIRED
        progressive_add_pct:       Number(profile.progressive_add_pct),       // ENGINEERING_REVIEW_REQUIRED
        prior_fail_weld_ids:       priorFailWeldIds,
      })

      if (result.selected.length === 0) continue

      // Insert nde_selections rows
      const rows = result.selected.map(s => ({
        organization_id: caller.organization_id!,
        nde_plan_id:     planId,
        weld_id:         s.weld_id,
        inspection_type: type,
        selection_seed:  result.seed,
        selection_rank:  s.selection_rank,
        selection_reason: s.selection_reason,
        result:          'pending',
      }))

      const { error: insertErr } = await admin
        .from('nde_selections')
        .insert(rows)

      if (insertErr) throw insertErr

      // Write weld_events for each selected weld
      for (const s of result.selected) {
        await writeWeldEvent({
          organizationId: caller.organization_id!,
          weldId:         s.weld_id,
          eventType:      'nde_selected',
          actorId:        caller.id,
          actorRole:      caller.role,
          metadata: {
            nde_plan_id:      planId,
            inspection_type:  type,
            selection_rank:   s.selection_rank,
            selection_reason: s.selection_reason,
            seed:             result.seed,
          },
        })
      }

      totalCreated += result.selected.length
      lastSeed = result.seed
      lastEngNote = result.engineering_note
    }

    return NextResponse.json({
      selections_created: totalCreated,
      seed:               lastSeed,
      engineering_note:   lastEngNote,
    })
  } catch (err) {
    console.error('[POST /api/nde/plans/[id]/run-selection]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// GET  /api/turnover/packages — list packages for a project
// POST /api/turnover/packages — create + kick off async generation
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { TURNOVER_GEN_ENABLED } from '@/intelligence/flags'
import { runGapCheck } from '@/lib/turnover-gap-check'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  project_id:   z.string().uuid(),
  package_name: z.string().min(1),
})

// ── Async generation (fire-and-forget) ───────────────────────

async function generatePackageAsync(
  packageId: string,
  projectId: string,
  organizationId: string,
  userId: string
) {
  const supabase = createAdminClient()
  try {
    // 1. Set status=generating, progress=10
    await supabase
      .from('turnover_packages')
      .update({ status: 'generating', progress_pct: 10 })
      .eq('id', packageId)

    // 2. Load project details
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    // 3. Load all welds (progress 30)
    await supabase
      .from('turnover_packages')
      .update({ progress_pct: 30 })
      .eq('id', packageId)
    const { data: welds } = await supabase
      .from('welds')
      .select('*, welders(full_name, stamp)')
      .eq('project_id', projectId)
      .eq('organization_id', organizationId)

    // 4. Load NDE selections with results (progress 50)
    await supabase
      .from('turnover_packages')
      .update({ progress_pct: 50 })
      .eq('id', packageId)
    const planIds =
      (
        await supabase
          .from('nde_plans')
          .select('id')
          .eq('project_id', projectId)
          .eq('organization_id', organizationId)
      ).data?.map(p => p.id) ?? []
    const { data: ndeSelections } =
      planIds.length > 0
        ? await supabase.from('nde_selections').select('*').in('nde_plan_id', planIds)
        : { data: [] }

    // 5. Assemble content object (progress 70)
    await supabase
      .from('turnover_packages')
      .update({ progress_pct: 70 })
      .eq('id', packageId)
    const content = {
      generated_at: new Date().toISOString(),
      project,
      weld_count: welds?.length ?? 0,
      welds: welds ?? [],
      nde_selections: ndeSelections ?? [],
    }
    const contentJson = JSON.stringify(content, null, 2)

    // 6. SHA-256 content hash for immutability
    const crypto = await import('crypto')
    const contentHash = crypto.createHash('sha256').update(contentJson).digest('hex')

    // 7. Complete (progress 100)
    await supabase
      .from('turnover_packages')
      .update({
        status: 'complete',
        progress_pct: 100,
        content_hash: contentHash,
        generated_by: userId,
        generated_at: new Date().toISOString(),
        // storage_path: left null — no Supabase Storage bucket configured yet
      })
      .eq('id', packageId)
  } catch (err) {
    await supabase
      .from('turnover_packages')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      })
      .eq('id', packageId)
  }
}

// ── GET ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!TURNOVER_GEN_ENABLED) {
      return NextResponse.json({ error: 'Turnover Generator is not enabled' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('turnover_packages')
      .select('*')
      .eq('organization_id', caller.organization_id!)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/turnover/packages]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!TURNOVER_GEN_ENABLED) {
      return NextResponse.json({ error: 'Turnover Generator is not enabled' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
    }
    const { project_id, package_name } = parsed.data

    const admin = createAdminClient()

    // Run gap check first — blocking gaps prevent generation
    const gapReport = await runGapCheck(admin, project_id, caller.organization_id!)
    if (gapReport.has_blocking_gaps) {
      return NextResponse.json(
        { error: 'Package cannot be generated until blocking gaps are resolved', gap_report: gapReport },
        { status: 422 }
      )
    }

    // Insert package record with status='pending' and gap_report snapshot
    const { data: pkg, error: insertError } = await admin
      .from('turnover_packages')
      .insert({
        organization_id: caller.organization_id!,
        project_id,
        package_name,
        status: 'pending',
        gap_report: gapReport,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    // Kick off async generation — do NOT await
    void generatePackageAsync(pkg.id, project_id, caller.organization_id!, caller.id)

    return NextResponse.json(
      { package_id: pkg.id, message: 'Generation started' },
      { status: 202 }
    )
  } catch (err) {
    console.error('[POST /api/turnover/packages]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

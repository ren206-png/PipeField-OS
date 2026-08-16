// ============================================================
// GET  /api/turnover/packages — list packages for a project
// POST /api/turnover/packages — create + kick off async generation
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { TURNOVER_GEN_ENABLED } from '@/intelligence/flags'
import { runGapCheck } from '@/lib/turnover-gap-check'
import { buildTurnoverPackage } from '@/lib/turnover/builder'
import { renderTurnoverPdf } from '@/lib/turnover/pdf-renderer'
import { z } from 'zod'
import crypto from 'crypto'

const TURNOVER_BUCKET = 'turnover-packages'

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

    // 2. Assemble all package data from DB (progress 40)
    await supabase
      .from('turnover_packages')
      .update({ progress_pct: 40 })
      .eq('id', packageId)

    const packageData = await buildTurnoverPackage(supabase, packageId, projectId, organizationId)

    // 3. Render PDF buffer (progress 70)
    await supabase
      .from('turnover_packages')
      .update({ progress_pct: 70 })
      .eq('id', packageId)

    const pdfBuffer = await renderTurnoverPdf(packageData)

    // 4. SHA-256 hash of PDF for immutability
    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    // 5. Upload to Supabase Storage (progress 90)
    await supabase
      .from('turnover_packages')
      .update({ progress_pct: 90 })
      .eq('id', packageId)

    const dateStr   = new Date().toISOString().split('T')[0]
    const safeName  = packageData.package_name.replace(/[^a-z0-9-_]/gi, '_').slice(0, 60)
    const storagePath = `${organizationId}/${projectId}/${dateStr}-${safeName}-${packageId.slice(0, 8)}.pdf`

    const { error: uploadError } = await supabase.storage
      .from(TURNOVER_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType:  'application/pdf',
        upsert:       true,
      })

    if (uploadError) {
      // Storage upload failed — complete with hash but no path; log the error
      console.error('[turnover] Storage upload failed:', uploadError.message)
      await supabase
        .from('turnover_packages')
        .update({
          status:        'complete',
          progress_pct:  100,
          content_hash:  pdfHash,
          generated_by:  userId,
          generated_at:  new Date().toISOString(),
          storage_path:  null,
          error_message: `PDF generated but storage upload failed: ${uploadError.message}`,
        })
        .eq('id', packageId)
      return
    }

    // 6. Mark complete with storage path (progress 100)
    await supabase
      .from('turnover_packages')
      .update({
        status:       'complete',
        progress_pct: 100,
        content_hash: pdfHash,
        generated_by: userId,
        generated_at: new Date().toISOString(),
        storage_path: storagePath,
      })
      .eq('id', packageId)

  } catch (err) {
    console.error('[turnover] generation failed:', err)
    await supabase
      .from('turnover_packages')
      .update({
        status:        'failed',
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

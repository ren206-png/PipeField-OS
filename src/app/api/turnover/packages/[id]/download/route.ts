// ============================================================
// GET /api/turnover/packages/[id]/download
// Returns a short-lived signed URL for the generated PDF.
// The PDF lives in the private 'turnover-packages' Storage bucket.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const TURNOVER_BUCKET = 'turnover-packages'
const SIGNED_URL_SECS = 300  // 5-minute window

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    const orgId = caller.organization_id
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 })

    const admin = createAdminClient()

    // Fetch package — verify org ownership
    const { data: pkg, error: fetchError } = await admin
      .from('turnover_packages')
      .select('id, status, storage_path, document_sha256, package_name')
      .eq('id', params.id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    const pkgTyped = pkg as {
      status:         string
      storage_path:   string | null
      document_sha256: string | null
      package_name:   string
    }

    if (pkgTyped.status !== 'complete') {
      return NextResponse.json(
        { error: 'Package is not yet complete', status: pkgTyped.status },
        { status: 409 }
      )
    }

    if (!pkgTyped.storage_path) {
      return NextResponse.json(
        { error: 'PDF file not available — storage upload may have failed during generation' },
        { status: 404 }
      )
    }

    // Generate signed URL (5-minute window; client downloads immediately)
    const { data: urlData, error: urlError } = await admin.storage
      .from(TURNOVER_BUCKET)
      .createSignedUrl(pkgTyped.storage_path, SIGNED_URL_SECS, {
        download: `${pkgTyped.package_name}.pdf`,
      })

    if (urlError) throw urlError

    return NextResponse.json({
      url:          urlData.signedUrl,
      expires_in:   SIGNED_URL_SECS,
      sha256:       pkgTyped.document_sha256,
      package_name: pkgTyped.package_name,
    })
  } catch (err) {
    console.error('[GET /api/turnover/packages/[id]/download]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

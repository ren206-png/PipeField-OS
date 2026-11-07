// ============================================================
// GET /api/knowledge/sources/[id]/file
// Opens a knowledge document through a short-lived signed URL (SEC-008).
// Replaces permanent public bucket URLs: access is re-checked on every
// open, so removed members and other orgs can't reuse an old link.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'knowledge-docs'
const SIGNED_URL_SECONDS = 300

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()
  const { data: source } = await admin
    .from('knowledge_sources')
    .select('storage_path')
    .eq('id', id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (!source?.storage_path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(source.storage_path as string, SIGNED_URL_SECONDS)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not open file' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl, { status: 302 })
}

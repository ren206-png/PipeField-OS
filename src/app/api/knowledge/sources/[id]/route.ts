// ============================================================
// GET    /api/knowledge/sources/[id]  — fetch single source
// PATCH  /api/knowledge/sources/[id]  — update metadata
// DELETE /api/knowledge/sources/[id]  — soft-delete (archive)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

// ── GET ───────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { id } = await params
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('knowledge_sources')
      .select(`
        *,
        knowledge_categories ( id, name, color, slug ),
        projects ( id, name, project_number )
      `)
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch source' },
      { status: 500 },
    )
  }
}

// ── PATCH ─────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const manageRoles = [
      'platform_admin', 'organization_owner', 'administrator', 'project_manager',
    ]
    if (!manageRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const admin = createAdminClient()

    // Verify ownership
    const { data: existing } = await admin
      .from('knowledge_sources')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowedFields = [
      'title', 'description', 'document_type', 'related_module',
      'category_id', 'project_id', 'tags', 'visibility', 'status', 'version',
    ]
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    const { data, error } = await admin
      .from('knowledge_sources')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Audit
    await admin.from('knowledge_audit_log').insert({
      organization_id: caller.organization_id,
      source_id:       id,
      action:          body.status === 'archived' ? 'archive' : 'edit',
      performed_by:    caller.auth_user_id,
      details:         updates,
    })

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 },
    )
  }
}

// ── DELETE (hard delete — admin only) ─────────────────────────
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const deleteRoles = ['platform_admin', 'organization_owner', 'administrator']
    if (!deleteRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('knowledge_sources')
      .select('id, storage_path, file_name')
      .eq('id', id)
      .eq('organization_id', caller.organization_id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete from storage
    await admin.storage.from('knowledge-docs').remove([existing.storage_path])

    // Audit before delete
    await admin.from('knowledge_audit_log').insert({
      organization_id: caller.organization_id,
      source_id:       id,
      action:          'delete',
      performed_by:    caller.auth_user_id,
      details:         { file_name: existing.file_name },
    })

    const { error } = await admin
      .from('knowledge_sources')
      .delete()
      .eq('id', id)
      .eq('organization_id', caller.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    )
  }
}

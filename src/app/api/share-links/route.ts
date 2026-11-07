// ============================================================
// GET  /api/share-links  — list org's share links
// POST /api/share-links  — create new link
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission, ORG_ADMIN_ROLES, type OrgAdminRole } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Share links are public (token-only) — SEC-005: they always expire,
// and links covering every project are admin-only.
const DEFAULT_EXPIRY_DAYS = 90
const MAX_EXPIRY_DAYS     = 365
const DAY_MS              = 24 * 60 * 60 * 1000

const createSchema = z.object({
  label:     z.string().min(1).max(300),
  projectId: z.string().uuid().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('client_share_links')
      .select(`
        id, token, label, expires_at, views, created_at,
        project_id,
        projects ( id, name )
      `)
      .eq('organization_id', caller.organization_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ links: data ?? [] })
  } catch (err) {
    console.error('GET /api/share-links error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requirePermission(req, 'projects:update')
    if (authError) return authError

    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const isOrgAdmin = ORG_ADMIN_ROLES.includes(caller.role as OrgAdminRole)
    if (!parsed.data.projectId && !isOrgAdmin) {
      return NextResponse.json({ error: 'Choose a project. Only admins can share all projects.' }, { status: 403 })
    }

    const now = Date.now()
    let expiresAt = new Date(now + DEFAULT_EXPIRY_DAYS * DAY_MS)
    if (parsed.data.expiresAt) {
      const requested = new Date(parsed.data.expiresAt)
      if (requested.getTime() <= now) {
        return NextResponse.json({ error: 'Expiry must be in the future' }, { status: 400 })
      }
      if (requested.getTime() > now + MAX_EXPIRY_DAYS * DAY_MS) {
        return NextResponse.json({ error: `Links can last at most ${MAX_EXPIRY_DAYS} days` }, { status: 400 })
      }
      expiresAt = requested
    }

    const admin = createAdminClient()

    // If projectId provided, verify it belongs to the org
    if (parsed.data.projectId) {
      const { data: project } = await admin
        .from('projects')
        .select('id')
        .eq('id', parsed.data.projectId)
        .eq('organization_id', caller.organization_id)
        .maybeSingle()

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
    }

    const { data, error } = await admin
      .from('client_share_links')
      .insert({
        organization_id: caller.organization_id,
        project_id:      parsed.data.projectId ?? null,
        label:           parsed.data.label,
        expires_at:      expiresAt.toISOString(),
        created_by:      caller.auth_user_id,
      })
      .select(`
        id, token, label, expires_at, views, created_at,
        project_id,
        projects ( id, name )
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ link: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/share-links error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// GET  /api/knowledge/categories  — list org's categories
// POST /api/knowledge/categories  — create custom category (admins)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const admin = createAdminClient()

    // If org has no categories yet, seed defaults
    const { count } = await admin
      .from('knowledge_categories')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', caller.organization_id)

    if ((count ?? 0) === 0) {
      // Insert defaults
      const defaults = [
        { name: 'Welding',               slug: 'welding',               color: '#f97316', sort_order: 1 },
        { name: 'QA/QC',                 slug: 'qa-qc',                 color: '#3b82f6', sort_order: 2 },
        { name: 'Hydrotesting',          slug: 'hydrotesting',          color: '#06b6d4', sort_order: 3 },
        { name: 'Flange Management',     slug: 'flange-management',     color: '#8b5cf6', sort_order: 4 },
        { name: 'Spool Fabrication',     slug: 'spool-fabrication',     color: '#ec4899', sort_order: 5 },
        { name: 'Field Installation',    slug: 'field-installation',    color: '#10b981', sort_order: 6 },
        { name: 'Safety',                slug: 'safety',                color: '#ef4444', sort_order: 7 },
        { name: 'Shutdowns/Turnarounds', slug: 'shutdowns-turnarounds', color: '#f59e0b', sort_order: 8 },
        { name: 'Equipment',             slug: 'equipment',             color: '#6366f1', sort_order: 9 },
        { name: 'Client Specifications', slug: 'client-specifications', color: '#14b8a6', sort_order: 10 },
        { name: 'Lessons Learned',       slug: 'lessons-learned',       color: '#84cc16', sort_order: 11 },
        { name: 'Training',              slug: 'training',              color: '#a855f7', sort_order: 12 },
        { name: 'Material Handling',     slug: 'material-handling',     color: '#f97316', sort_order: 13 },
        { name: 'Productivity',          slug: 'productivity',          color: '#22c55e', sort_order: 14 },
        { name: 'Defect Prevention',     slug: 'defect-prevention',     color: '#ef4444', sort_order: 15 },
        { name: 'Crew Management',       slug: 'crew-management',       color: '#64748b', sort_order: 16 },
      ]
      await admin.from('knowledge_categories').insert(
        defaults.map(d => ({ ...d, organization_id: caller.organization_id, is_default: true }))
      )
    }

    const { data, error } = await admin
      .from('knowledge_categories')
      .select('*')
      .eq('organization_id', caller.organization_id)
      .order('sort_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch categories' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const manageRoles = ['platform_admin', 'organization_owner', 'administrator', 'project_manager']
    if (!manageRoles.includes(caller.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, color } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('knowledge_categories')
      .insert({
        organization_id: caller.organization_id,
        name:            name.trim(),
        slug,
        description:     description?.trim() || null,
        color:           color || '#64748b',
        is_default:      false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create category' },
      { status: 500 },
    )
  }
}

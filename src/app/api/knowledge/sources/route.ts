// ============================================================
// GET  /api/knowledge/sources  — list org's knowledge sources
// Query params: status, category_id, project_id, document_type,
//               related_module, q (search title/description)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const status        = searchParams.get('status')        // active | archived | superseded
    const category_id   = searchParams.get('category_id')
    const project_id    = searchParams.get('project_id')
    const document_type = searchParams.get('document_type')
    const related_module = searchParams.get('related_module')
    const q             = (searchParams.get('q') ?? '').slice(0, 200) || null  // full-text search
    const limit         = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
    const offset        = parseInt(searchParams.get('offset') ?? '0')

    const admin = createAdminClient()

    let query = admin
      .from('knowledge_sources')
      .select(`
        *,
        knowledge_categories ( id, name, color, slug ),
        projects ( id, name, project_number )
      `)
      .eq('organization_id', caller.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status)         query = query.eq('status', status)
    else                query = query.neq('status', 'archived') // default: exclude archived
    if (category_id)    query = query.eq('category_id', category_id)
    if (project_id)     query = query.eq('project_id', project_id)
    if (document_type)  query = query.eq('document_type', document_type)
    if (related_module) query = query.eq('related_module', related_module)
    if (q)              query = query.ilike('title', `%${q}%`)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ sources: data ?? [], total: count ?? 0 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch sources' },
      { status: 500 },
    )
  }
}

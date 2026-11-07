// POST /api/welds — create a new weld
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-auth'
import { createWeld, weldCreateSchema } from '@/lib/welds/create-weld'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requirePermission(req, 'welds:create')
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const body   = await req.json()
  const parsed = weldCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
  }

  const result = await createWeld({ ...caller, organization_id: caller.organization_id }, parsed.data)
  if (!result.ok) return NextResponse.json(result.body, { status: result.status })
  return NextResponse.json(result.weld, { status: 201 })
}

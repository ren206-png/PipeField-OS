// ============================================================
// PATCH  /api/welds/[id]/checklists/[checklistId]
//   Body: { items: ChecklistItem[] }  — full updated items array
// DELETE /api/welds/[id]/checklists/[checklistId]
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const itemSchema = z.object({
  id:         z.string(),
  label:      z.string(),
  required:   z.boolean(),
  checked:    z.boolean(),
  checked_at: z.string().nullable(),
  checked_by: z.string().nullable(),
})

const patchSchema = z.object({
  items: z.array(itemSchema).min(1),
})

interface RouteContext { params: Promise<{ id: string; checklistId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { id: weldId, checklistId } = await params
    const body   = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const allChecked   = parsed.data.items.every(i => i.checked)
    const completedAt  = allChecked ? new Date().toISOString() : null
    const completedBy  = allChecked ? caller.auth_user_id : null

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('weld_checklists')
      .update({
        items:        parsed.data.items,
        completed_at: completedAt,
        completed_by: completedBy,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', checklistId)
      .eq('weld_id', weldId)
      .eq('organization_id', caller.organization_id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('weld-checklists.patch', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { id: weldId, checklistId } = await params
    const admin = createAdminClient()

    const { error } = await admin
      .from('weld_checklists')
      .delete()
      .eq('id', checklistId)
      .eq('weld_id', weldId)
      .eq('organization_id', caller.organization_id)

    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('weld-checklists.delete', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

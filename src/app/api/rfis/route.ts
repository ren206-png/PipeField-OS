// ============================================================
// POST /api/rfis — create RFI + fire in-app notification
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const RfiSchema = z.object({
  project_id:       z.string().uuid(),
  rfi_number:       z.string().min(1).max(50),
  title:            z.string().min(1).max(500),
  discipline:       z.string().min(1).max(100),
  priority:         z.enum(['low', 'normal', 'high', 'urgent']),
  question:         z.string().min(1).max(5000),
  background:       z.string().max(5000).nullish(),
  drawing_refs:     z.string().max(500).nullish(),
  spec_refs:        z.string().max(500).nullish(),
  submitted_to:     z.string().max(255).nullish(),
  submitted_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  required_by_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  status:           z.enum(['draft', 'submitted', 'under_review', 'answered', 'closed', 'void']).optional(),
})

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const parsed = RfiSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: rfi, error } = await admin
    .from('rfis')
    .insert({ ...parsed.data, organization_id: caller.organization_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  createNotification({
    organizationId: caller.organization_id!,
    type:  'rfi_created',
    title: `RFI Raised: ${rfi.rfi_number}`,
    body:  rfi.subject ?? rfi.title ?? 'Request for information created',
    href:  `/documents/rfis/${rfi.id}`,
  }).catch((err: unknown) => {
    logger.error('rfis.notification.failed', err)
  })

  return NextResponse.json(rfi, { status: 201 })
}

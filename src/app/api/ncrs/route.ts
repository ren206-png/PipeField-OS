// ============================================================
// POST /api/ncrs — create NCR + fire in-app notification
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const NcrSchema = z.object({
  project_id:        z.string().uuid(),
  ncr_number:        z.string().min(1).max(50),
  title:             z.string().min(1).max(500),
  discipline:        z.string().min(1).max(100),
  severity:          z.enum(['minor', 'major', 'critical']),
  ncr_type:          z.string().min(1).max(100),
  description:       z.string().min(1).max(5000),
  location:          z.string().max(500).nullish(),
  drawing_ref:       z.string().max(500).nullish(),
  spec_ref:          z.string().max(500).nullish(),
  weld_id:           z.string().uuid().nullish(),
  raised_by:         z.string().min(1).max(255),
  raised_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assigned_to:       z.string().max(255).nullish(),
  due_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  status:            z.enum(['open', 'under_review', 'disposition_pending', 'in_rework', 'verification_pending', 'closed', 'void']).optional(),
})

export async function POST(req: NextRequest) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const parsed = NcrSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: ncr, error } = await admin
    .from('ncrs')
    .insert({ ...parsed.data, organization_id: caller.organization_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire in-app notification for all org members (user_id null = org-wide)
  createNotification({
    organizationId: caller.organization_id!,
    type:  'ncr_created',
    title: `NCR Raised: ${ncr.ncr_number}`,
    body:  ncr.title ?? 'Non-conformance report created',
    href:  `/documents/ncrs/${ncr.id}`,
  }).catch((err: unknown) => {
    logger.error('ncrs.notification.failed', err)
  })

  return NextResponse.json(ncr, { status: 201 })
}

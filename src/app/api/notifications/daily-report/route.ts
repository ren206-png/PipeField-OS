// ============================================================
// POST /api/notifications/daily-report
// Notifies admins + project managers when a daily field report
// is submitted. Called fire-and-forget from the client.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDailyReportEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const schema = z.object({
  reportId:    z.string().uuid(),
  projectId:   z.string().uuid(),
  reportDate:  z.string(),
  summaryLine: z.string().max(200),
})

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError

    const body   = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { reportId, projectId, reportDate, summaryLine } = parsed.data

    const admin = createAdminClient()

    // Get project name
    const { data: project } = await admin
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle()

    // Get submitter name
    const { data: submitter } = await admin
      .from('user_profiles')
      .select('full_name')
      .eq('id', caller.id)
      .maybeSingle()

    // Notify admins and project managers in the org
    const { data: recipients } = await admin
      .from('user_profiles')
      .select('email, full_name')
      .eq('organization_id', caller.organization_id!)
      .in('role', ['administrator', 'organization_owner', 'project_manager', 'foreman'])
      .eq('is_active', true)

    const projectName   = project?.name ?? 'Unknown Project'
    const reporterName  = submitter?.full_name ?? 'A team member'

    await Promise.allSettled(
      (recipients ?? []).map(r =>
        r.email
          ? sendDailyReportEmail({
              to:           r.email,
              reporterName,
              projectName,
              reportDate,
              reportId,
              summaryLine,
            })
          : Promise.resolve()
      )
    )

    return NextResponse.json({ sent: recipients?.length ?? 0 })

  } catch (err) {
    console.error('[/api/notifications/daily-report]', err)
    return NextResponse.json({ error: 'Notification failed' }, { status: 500 })
  }
}

// ============================================================
// GET /api/organization/invite/[token]
// Public endpoint — returns the invite details (org name, role)
// so the /invite page can show what org the user is joining.
// Does NOT require auth — the user hasn't signed up yet.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Supabase join shape from `invites.select('*, organizations(id, name)')` */
interface InviteOrg { id: string; name: string }

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: invite, error } = await admin
      .from('pending_invites')
      .select(`
        id,
        email,
        role,
        status,
        expires_at,
        organizations (
          id,
          name
        )
      `)
      .eq('token', token)
      .maybeSingle()

    if (error || !invite) {
      return NextResponse.json({ error: 'Invite not found or invalid' }, { status: 404 })
    }

    // Check if expired
    if (invite.status !== 'pending') {
      return NextResponse.json(
        { error: `Invite is ${invite.status}. Please ask your admin for a new invite.` },
        { status: 410 }
      )
    }

    if (new Date(invite.expires_at) < new Date()) {
      // Mark as expired
      await admin
        .from('pending_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)

      return NextResponse.json(
        { error: 'This invite link has expired. Please ask your admin for a new one.' },
        { status: 410 }
      )
    }

    const org = invite.organizations as unknown as InviteOrg | null

    return NextResponse.json({
      valid:     true,
      email:     invite.email,
      role:      invite.role,
      org_id:    org?.id,
      org_name:  org?.name,
      expires_at: invite.expires_at,
    })
  } catch (err) {
    console.error('[/api/organization/invite/[token] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

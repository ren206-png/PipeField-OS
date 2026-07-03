import { APP_URL } from '@/env'
// ============================================================
// POST /api/organization/invite
// Creates a pending_invites row and sends an invite email
// via Supabase Auth's generateLink (OTP invite method).
//
// Org admins only — scoped to their own organization.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrgAdmin } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const VALID_ROLES = [
  'organization_owner','administrator','project_manager',
  'foreman','qa_inspector','shop_fabricator','pipefitter','client_viewer',
] as const

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email required'),
  role:  z.enum(VALID_ROLES, { errorMap: () => ({ message: 'Invalid role' }) }),
})

export async function POST(req: NextRequest) {
  const { caller, error } = await requireOrgAdmin()
  if (error) return error

  // 20 invites per org per hour — prevents runaway invite spamming
  if (!rateLimit({ key: `invite:${caller.organization_id}`, limit: 20, windowMs: 60 * 60_000 })) {
    return NextResponse.json({ error: 'Too many invites sent. Please wait before sending more.' }, { status: 429 })
  }

  const parsed = inviteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
      { status: 400 }
    )
  }
  const { email, role } = parsed.data

  const admin = createAdminClient()

  // Check if user already exists in this org
  const { data: existing } = await admin
    .from('user_profiles')
    .select('id, email')
    .eq('email', email)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'This email is already a member of your organization.' },
      { status: 409 }
    )
  }

  // Cancel any prior pending invite for same email+org
  await admin
    .from('pending_invites')
    .update({ status: 'cancelled' })
    .eq('email', email)
    .eq('organization_id', caller.organization_id)
    .eq('status', 'pending')

  // Create the pending invite row
  const { data: invite, error: inviteError } = await admin
    .from('pending_invites')
    .insert({
      email:           email,
      organization_id: caller.organization_id,
      role,
      invited_by:      caller.auth_user_id,
      status:          'pending',
      expires_at:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id, token')
    .single()

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  // Build the signup link — pointing to /invite page with token
  const appUrl = APP_URL
  const inviteUrl = `${appUrl}/invite?token=${invite.token}&email=${encodeURIComponent(email)}`

  // Get org name for the email
  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', caller.organization_id)
    .maybeSingle()

  // Use Supabase Auth admin to send the invite email
  // generateLink creates a magic link — the user clicks it to authenticate
  // then lands on our /invite page to complete their profile setup.
  const { error: emailError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteUrl,
    data: {
      invited_by_name:  caller.full_name,
      organization_name: org?.name ?? 'PipeField OS',
      role,
      invite_token: invite.token,
    },
  })

  if (emailError) {
    // If the user already has a Supabase auth account, inviteUserByEmail fails.
    // That's OK — they'll use their existing account. The token is stored.
    if (!emailError.message.includes('already been registered')) {
      // Non-critical: log but don't fail — invite row is created
      console.error('[invite] email send failed:', emailError.message)
    }
  }

  return NextResponse.json({
    success:    true,
    invite_id:  invite.id,
    invite_url: inviteUrl,   // returned so admin can copy it manually if needed
  }, { status: 201 })
}

// ── GET — list pending invites for caller's org ───────────────
export async function GET(_req: NextRequest) {
  try {
    const getAuth = await requireOrgAdmin()
    if (getAuth.error) return getAuth.error
    const { caller: getCaller } = getAuth

    const admin = createAdminClient()
    const { data: invites, error: listError } = await admin
      .from('pending_invites')
      .select('id, email, role, status, created_at, expires_at, invited_by')
      .eq('organization_id', getCaller.organization_id)
      .order('created_at', { ascending: false })

    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

    return NextResponse.json({ invites: invites ?? [] })
  } catch (err) {
    console.error('[/api/organization/invite GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE — cancel a pending invite ─────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const delAuth = await requireOrgAdmin()
    if (delAuth.error) return delAuth.error
    const { caller: delCaller } = delAuth

    const { searchParams } = new URL(req.url)
    const inviteId = searchParams.get('id')
    if (!inviteId) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const admin = createAdminClient()
    const { error: cancelError } = await admin
      .from('pending_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId)
      .eq('organization_id', delCaller.organization_id)

    if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/organization/invite DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

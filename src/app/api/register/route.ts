// ============================================================
// POST /api/register
// Two paths:
//   A. New org signup — creates organization + owner profile
//   B. Invite accept  — matches token, joins existing org
//
// Uses the admin (service role) client to bypass RLS.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/utils'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sendWelcomeEmail } from '@/lib/email'
import { z } from 'zod'

const schema = z.object({
  authUserId:       z.string().uuid(),
  email:            z.string().trim().toLowerCase().email(),
  fullName:         z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(1).max(200).optional(),
  inviteToken:      z.string().optional(),
})

export async function POST(req: NextRequest) {
  // 5 registrations per IP per 15 minutes — prevents mass account creation
  const ip = getClientIp(req.headers)
  if (!rateLimit({ key: `register:${ip}`, limit: 5, windowMs: 15 * 60_000 })) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const { authUserId, email, fullName, organizationName, inviteToken } = parsed.data

    const admin = createAdminClient()

    // ── Verify authUserId ownership ────────────────────────
    // Prevent IDOR: confirm the supplied UUID actually belongs to
    // the email in the request (attacker cannot confirm someone
    // else's account by guessing their UUID).
    const { data: authUser } = await admin.auth.admin.getUserById(authUserId)
    if (!authUser?.user || authUser.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid registration credentials' }, { status: 400 })
    }
    // Reject stale tokens: only accept registrations within 10 minutes of account creation
    const createdAt = new Date(authUser.user.created_at ?? 0)
    if (Date.now() - createdAt.getTime() > 10 * 60_000) {
      return NextResponse.json({ error: 'Registration token expired. Please sign up again.' }, { status: 400 })
    }

    // ── Auto-confirm email ─────────────────────────────────
    await admin.auth.admin.updateUserById(authUserId, {
      email_confirm: true,
    })

    // ── PATH B: Invite-based signup ────────────────────────
    if (inviteToken) {
      const { data: invite, error: inviteErr } = await admin
        .from('pending_invites')
        .select('id, email, role, organization_id, status, expires_at')
        .eq('token', inviteToken)
        .maybeSingle()

      if (inviteErr || !invite) {
        return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 })
      }

      if (invite.status !== 'pending') {
        return NextResponse.json(
          { error: `Invite already ${invite.status}` },
          { status: 400 }
        )
      }

      if (new Date(invite.expires_at) < new Date()) {
        await admin.from('pending_invites').update({ status: 'expired' }).eq('id', invite.id)
        return NextResponse.json({ error: 'Invite expired' }, { status: 400 })
      }

      // Create the profile in the invited org
      const { error: profileError } = await admin
        .from('user_profiles')
        .insert({
          auth_user_id:    authUserId,
          organization_id: invite.organization_id,
          email:           email,
          full_name:       fullName,
          role:            invite.role,
          status:          'active',
          is_active:       true,
        })

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 })
      }

      sendWelcomeEmail({ to: email, fullName, orgName: '' }).catch(() => {})

      // Mark invite accepted
      await admin
        .from('pending_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id)

      // Add to organization_members table
      await admin
        .from('organization_members')
        .insert({
          organization_id: invite.organization_id,
          user_id:         authUserId,
          role:            invite.role,
          status:          'active',
        })

      return NextResponse.json(
        { success: true, orgId: invite.organization_id, path: 'invite' },
        { status: 201 }
      )
    }

    // ── PATH A: New organization signup ────────────────────
    if (!organizationName) {
      return NextResponse.json(
        { error: 'organizationName required for new account signup' },
        { status: 400 }
      )
    }

    const insertOrg = async (slug: string) =>
      admin
        .from('organizations')
        .insert({
          name:                organizationName,
          slug,
          subscription_tier:   'free_trial',
          subscription_status: 'trialing',
          owner_user_id:       authUserId,
        })
        .select('id')
        .single()

    let orgResult = await insertOrg(slugify(organizationName))

    if (orgResult.error?.code === '23505') {
      orgResult = await insertOrg(`${slugify(organizationName)}-${Date.now()}`)
    }

    if (orgResult.error) {
      return NextResponse.json({ error: orgResult.error.message }, { status: 500 })
    }

    const orgId = orgResult.data!.id

    const { error: profileError } = await admin
      .from('user_profiles')
      .insert({
        auth_user_id:    authUserId,
        organization_id: orgId,
        email:           email,
        full_name:       fullName,
        role:            'organization_owner',
        status:          'active',
        is_active:       true,
      })

    if (profileError) {
      await admin.from('organizations').delete().eq('id', orgId)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    sendWelcomeEmail({ to: email, fullName, orgName: organizationName }).catch(() => {})

    await admin
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id:         authUserId,
        role:            'organization_owner',
        status:          'active',
      })

    return NextResponse.json({ success: true, orgId, path: 'new_org' }, { status: 201 })

  } catch (err) {
    console.error('[/api/register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

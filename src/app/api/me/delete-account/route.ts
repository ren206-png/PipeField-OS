// ============================================================
// POST /api/me/delete-account
// Self-service account deletion (Google Play / App Store requirement).
//
// What happens:
//   • Personal-only data is deleted: personal work log, notifications,
//     push subscriptions, knowledge permissions granted to the user.
//   • The profile is scrubbed: name → "Deleted user", email replaced with
//     an undeliverable placeholder, phone / welder stamp / avatar cleared,
//     deactivated.
//   • The login is soft-deleted in Supabase Auth (identifiers obfuscated,
//     can never sign in again).
//   • Company QC records the user created (welds, inspections, signatures…)
//     are KEPT and now show "Deleted user": they belong to the company and
//     are quality records that codes such as ASME B31.3 require to be kept.
//     Foreign keys also prevent removing the user row while they exist.
//   • If the user is the only active member of their company, its Stripe
//     subscription is cancelled so nobody is charged for a deleted account.
//
// Lives under /api/me so the billing write-lock never blocks it.
// Body: { "confirm": "DELETE" }
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete'])

export async function POST(req: NextRequest) {
  const { caller, error } = await requireAuth(req)
  if (error) return error

  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 })
  }
  if (caller.role === 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin accounts cannot be deleted from the app.' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()
  const profileId = caller.id
  const authUserId = caller.auth_user_id
  const orgId = caller.organization_id

  try {
    // ── Sole member? cancel the company subscription ──────────
    if (orgId) {
      const { count } = await admin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .neq('id', profileId)

      if ((count ?? 0) === 0) {
        const { data: org } = await admin
          .from('organizations')
          .select('stripe_subscription_id, subscription_status')
          .eq('id', orgId)
          .maybeSingle()
        if (org?.stripe_subscription_id && ACTIVE_SUB_STATUSES.has(org.subscription_status ?? '')) {
          await getStripe().subscriptions.cancel(org.stripe_subscription_id)
        }
      }
    }

    // ── Delete personal-only data ─────────────────────────────
    const deletions = await Promise.all([
      admin.from('personal_work_log').delete().eq('user_id', authUserId),
      admin.from('push_subscriptions').delete().eq('user_id', authUserId),
      admin.from('notifications').delete().eq('user_id', profileId),
      admin.from('knowledge_permissions').delete().eq('granted_to_user', authUserId),
    ])
    const delError = deletions.find(r => r.error)?.error
    if (delError) throw new Error(delError.message)

    // ── Scrub the profile ─────────────────────────────────────
    const { error: scrubError } = await admin
      .from('user_profiles')
      .update({
        full_name:    'Deleted user',
        email:        `deleted-${profileId}@deleted.invalid`,
        phone:        null,
        welder_stamp: null,
        avatar_url:   null,
        is_active:    false,
        status:       'deactivated',
        updated_at:   new Date().toISOString(),
      })
      .eq('id', profileId)
    if (scrubError) throw new Error(scrubError.message)

    // ── Remove the login (soft delete keeps FK targets valid) ─
    const { error: authError } = await admin.auth.admin.deleteUser(authUserId, true)
    if (authError) throw new Error(authError.message)

    logger.info('account.deleted', { profileId, orgId })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    logger.error('account.delete_failed', err)
    return NextResponse.json(
      { error: 'Could not delete the account. Please try again or contact support.' },
      { status: 500 },
    )
  }
}

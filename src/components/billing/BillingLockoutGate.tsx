'use client'
// ============================================================
// BillingLockoutGate — full-screen overlay when the org is
// in read-only lockout due to a billing issue.
//
// Rendered in DashboardShell so it covers every dashboard page.
// When the org is in good standing, this component returns null
// and has zero render cost.
//
// Two lockout states:
//
//  payment_failed — past_due + grace window expired
//    Shows: payment failure message + "Update Payment" CTA
//    (links to Stripe billing portal)
//
//  trial_expired — free_trial + trial_ends_at in the past
//    Shows: trial expired message + "Choose a Plan" CTA
//    (links to /settings/billing)
//
// The page content is still rendered behind the overlay so
// the browser doesn't lose state — the overlay just blocks
// interaction and prevents reading sensitive data.
//
// Admins and non-admins see the same lockout; only admins
// can resolve it (portal link / billing page).
// ============================================================
import { CreditCard, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useOrganization } from '@/hooks/useOrganization'
import { useAuth } from '@/hooks/useAuth'
import { getLockoutReason } from '@/lib/billing-access'
import { apiFetch } from '@/lib/apiFetch'

export function BillingLockoutGate() {
  const { organization } = useOrganization()
  const { profile }      = useAuth()

  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalError,   setPortalError]   = useState<string | null>(null)

  const reason  = getLockoutReason(organization)
  const isAdmin = profile?.role === 'administrator'
               || profile?.role === 'organization_owner'
               || profile?.role === 'platform_admin'

  // Not locked — render nothing
  if (!reason) return null

  async function openPortal() {
    setLoadingPortal(true)
    setPortalError(null)
    try {
      const res  = await apiFetch('/api/billing/portal', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not open billing portal')
      window.location.href = body.url
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Something went wrong')
      setLoadingPortal(false)
    }
  }

  const isPaymentFailed = reason === 'payment_failed'
  const isTrialExpired  = reason === 'trial_expired'

  const accentColor = isPaymentFailed ? '#f97316' : '#2E8AFF'
  const icon        = isPaymentFailed ? CreditCard : Lock

  return (
    // Fixed overlay — sits above page content, blocks interaction
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-surface-950/90 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lockout-title"
    >
      <div className="w-full max-w-md mx-4">
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            borderColor:     `${accentColor}40`,
            backgroundColor: '#1a1d27',
          }}
        >
          {/* Header accent */}
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: accentColor }}
          />

          <div className="p-8 text-center space-y-5">
            {/* Icon */}
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              {isPaymentFailed
                ? <CreditCard className="w-8 h-8" style={{ color: accentColor }} />
                : <Lock       className="w-8 h-8" style={{ color: accentColor }} />
              }
            </div>

            {/* Message */}
            <div className="space-y-2">
              <h2
                id="lockout-title"
                className="text-xl font-bold text-surface-50"
              >
                {isPaymentFailed ? 'Payment required' : 'Trial ended'}
              </h2>
              <p className="text-sm text-surface-400 leading-relaxed max-w-sm mx-auto">
                {isPaymentFailed
                  ? 'Your payment failed and the grace period has ended. Update your payment method to restore full access. Your data is safe.'
                  : 'Your free trial has ended. Choose a plan to continue using PipeField OS. Your data is safe and waiting for you.'
                }
              </p>
            </div>

            {/* CTA — admin only */}
            {isAdmin && (
              <div className="space-y-3">
                {isPaymentFailed ? (
                  <button
                    onClick={openPortal}
                    disabled={loadingPortal}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    {loadingPortal
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CreditCard className="w-4 h-4" />
                    }
                    {loadingPortal ? 'Opening portal…' : 'Update Payment Method'}
                    {!loadingPortal && <ArrowRight className="w-4 h-4" />}
                  </button>
                ) : (
                  <a
                    href="/settings/billing"
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all"
                    style={{ backgroundColor: accentColor }}
                  >
                    <CreditCard className="w-4 h-4" />
                    Choose a Plan
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}

                {portalError && (
                  <p className="text-sm text-red-400">{portalError}</p>
                )}

                <p className="text-xs text-surface-600">
                  {isPaymentFailed
                    ? 'No data will be deleted. Access restores immediately after payment.'
                    : 'No data will be deleted. Access restores immediately after subscribing.'
                  }
                </p>
              </div>
            )}

            {/* Non-admin message */}
            {!isAdmin && (
              <div className="p-3 rounded-xl bg-surface-800 border border-surface-700">
                <p className="text-sm text-surface-400">
                  Please contact your organization administrator to{' '}
                  {isPaymentFailed ? 'update the payment method' : 'subscribe to a plan'}.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'
// ============================================================
// BillingStatusBanner — shows at the top of the billing page.
// Renders different content based on subscription_status:
//
//  trialing  → days remaining + cancel trial option
//  canceled  → trial end date + resubscribe prompt
//  past_due  → payment failed warning
//  active    → nothing (no banner needed for healthy accounts)
//  free_trial → nothing (TrialSignupCard handles this state)
//
// Only visible to admins — read-only role just sees the plans.
// ============================================================
import { useState } from 'react'
import { Zap, AlertCircle, Clock, XCircle, Loader2, CheckCircle2 } from 'lucide-react'
import type { Organization } from '@/types'
import { apiFetch } from '@/lib/apiFetch'

interface Props {
  organization: Organization
  isAdmin:      boolean
  onCanceled?:  () => void
}

function daysRemaining(isoDate: string | null): number {
  if (!isoDate) return 0
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'soon'
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function BillingStatusBanner({ organization, isAdmin, onCanceled }: Props) {
  const [canceling,    setCanceling]    = useState(false)
  const [cancelError,  setCancelError]  = useState<string | null>(null)
  const [canceledDate, setCanceledDate] = useState<string | null>(null)
  const [showConfirm,  setShowConfirm]  = useState(false)

  const status      = organization.subscription_status
  const trialEndsAt = organization.trial_ends_at
  const days        = daysRemaining(trialEndsAt)

  async function handleCancelTrial() {
    setCanceling(true)
    setCancelError(null)
    try {
      const res  = await apiFetch('/api/billing/cancel-trial', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Cancel failed')
      setCanceledDate(body.trial_ends_at)
      setShowConfirm(false)
      onCanceled?.()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCanceling(false)
    }
  }

  // ── Nothing to show for healthy active accounts ────────────
  if (status === 'active') return null

  // ── Just canceled — show confirmation ──────────────────────
  if (canceledDate) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-300">
        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-surface-100">Trial canceled</p>
          <p className="text-sm text-surface-400 mt-0.5">
            Your account stays active until <strong className="text-surface-200">{formatDate(canceledDate)}</strong>,
            then downgrades to the free tier. You can resubscribe any time.
          </p>
        </div>
      </div>
    )
  }

  // ── Trialing ───────────────────────────────────────────────
  if (status === 'trialing') {
    const urgency = days <= 3 ? 'high' : days <= 7 ? 'medium' : 'low'
    const colors  = {
      low:    { bg: 'bg-brand-500/10 border-brand-500/20',    icon: 'text-brand-400',  text: 'text-brand-200' },
      medium: { bg: 'bg-amber-500/10 border-amber-500/20',    icon: 'text-amber-400',  text: 'text-amber-200' },
      high:   { bg: 'bg-red-500/10   border-red-500/20',      icon: 'text-red-400',    text: 'text-red-200'   },
    }[urgency]

    return (
      <div className={`p-4 rounded-xl border ${colors.bg}`}>
        <div className="flex items-start gap-3">
          <Zap className={`w-5 h-5 flex-shrink-0 mt-0.5 ${colors.icon}`} />
          <div className="flex-1">
            <p className={`font-semibold ${colors.text}`}>
              {days > 0
                ? `${days} day${days === 1 ? '' : 's'} left in your free trial`
                : 'Your free trial ends today'}
            </p>
            <p className="text-sm text-surface-400 mt-0.5">
              {trialEndsAt
                ? `Trial ends ${formatDate(trialEndsAt)}. Add a plan below to keep full access.`
                : 'Add a plan below to keep full access after your trial.'}
            </p>
            {cancelError && (
              <p className="text-sm text-red-400 mt-2">{cancelError}</p>
            )}
          </div>

          {/* Cancel trial — admin only */}
          {isAdmin && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex-shrink-0 text-xs text-surface-500 hover:text-surface-300 underline underline-offset-2 transition-colors"
            >
              Cancel trial
            </button>
          )}
        </div>

        {/* Inline confirmation */}
        {showConfirm && (
          <div className="mt-3 ml-8 p-3 rounded-lg bg-surface-800 border border-surface-700">
            <p className="text-sm text-surface-200 font-medium mb-1">Cancel your free trial?</p>
            <p className="text-xs text-surface-400 mb-3">
              Your account stays active until {formatDate(trialEndsAt)}, then reverts to
              the free tier. No charge will be made.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelTrial}
                disabled={canceling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {canceling ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Yes, cancel trial
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-surface-700 text-surface-300 text-xs font-semibold hover:bg-surface-600 transition-colors"
              >
                Keep trial
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Canceled ───────────────────────────────────────────────
  if (status === 'canceled') {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-800 border border-surface-700 text-surface-300">
        <Clock className="w-5 h-5 text-surface-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-surface-200">Subscription canceled</p>
          <p className="text-sm text-surface-400 mt-0.5">
            {trialEndsAt
              ? `Your access ends on ${formatDate(trialEndsAt)}.`
              : 'Your access has ended.'}
            {' '}Select a plan below to reactivate.
          </p>
        </div>
      </div>
    )
  }

  // ── Past due ───────────────────────────────────────────────
  if (status === 'past_due') {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-200">
        <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Payment failed</p>
          <p className="text-sm text-orange-300/80 mt-0.5">
            We couldn&apos;t charge your card. Click <strong>Manage Billing</strong> above
            to update your payment method and keep your account active.
          </p>
        </div>
      </div>
    )
  }

  return null
}

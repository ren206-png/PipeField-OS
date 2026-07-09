'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Building2, Lock, CheckCircle2, Loader2, AlertCircle, CreditCard, ArrowRight, MessageSquare, Mail, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLE_LABELS } from '@/types'
import { getInitials } from '@/lib/utils'
import { apiFetch } from '@/lib/apiFetch'

// ── Schemas ──────────────────────────────────────────────────

const profileSchema = z.object({
  full_name:    z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone:        z.string().max(30).optional(),
  welder_stamp: z.string().max(10).optional(),
})

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
})

type ProfileValues  = z.infer<typeof profileSchema>
type PasswordValues = z.infer<typeof passwordSchema>

// ── Section wrapper ───────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon:     React.ElementType
  title:    string
  children: React.ReactNode
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-surface-700/60">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-400" />
        </div>
        <h2 className="text-base font-semibold text-surface-100">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const { profile, isPlatformAdmin, isLoading, refreshProfile } = useAuth()

  const [profileSaved,  setProfileSaved]  = useState(false)
  const [profileError,  setProfileError]  = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [emailSaved,    setEmailSaved]    = useState(false)
  const [emailError,    setEmailError]    = useState<string | null>(null)
  const [emailLoading,  setEmailLoading]  = useState(false)
  const [newEmail,      setNewEmail]      = useState('')

  // ── Profile form ─────────────────────────────────────────────
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name:    '',
      phone:        '',
      welder_stamp: '',
    },
  })

  // Populate form once profile arrives from context (already cached — fast)
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        full_name:    profile.full_name    ?? '',
        phone:        profile.phone        ?? '',
        welder_stamp: profile.welder_stamp ?? '',
      })
    }
  }, [profile, profileForm])

  async function saveProfile(values: ProfileValues) {
    if (!profile) return
    setProfileError(null)
    setProfileSaved(false)

    const { error } = await createClient()
      .from('user_profiles')
      .update({
        full_name:    values.full_name,
        phone:        values.phone        || null,
        welder_stamp: values.welder_stamp ? values.welder_stamp.toUpperCase() : null,
      })
      .eq('id', profile.id)

    if (error) {
      setProfileError(error.message)
    } else {
      setProfileSaved(true)
      await refreshProfile()
      setTimeout(() => setProfileSaved(false), 3000)
    }
  }

  // ── Email change (platform_admin only) ───────────────────────
  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setEmailSaved(false)
    setEmailLoading(true)

    const res = await apiFetch('/api/settings/email', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: newEmail }),
    })

    const data = await res.json()

    if (!res.ok) {
      setEmailError(data.error ?? 'Failed to update email')
    } else {
      setEmailSaved(true)
      setNewEmail('')
      await refreshProfile()
      setTimeout(() => setEmailSaved(false), 4000)
    }
    setEmailLoading(false)
  }

  // ── Password form ─────────────────────────────────────────────
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  })

  async function savePassword(values: PasswordValues) {
    setPasswordError(null)
    setPasswordSaved(false)

    const { error } = await createClient().auth.updateUser({
      password: values.newPassword,
    })

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSaved(true)
      passwordForm.reset()
      setTimeout(() => setPasswordSaved(false), 3000)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <div className="h-8 w-32 bg-surface-800 rounded animate-pulse" />
          <div className="h-4 w-56 bg-surface-800 rounded animate-pulse mt-2" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-6 space-y-4">
            <div className="h-5 w-40 bg-surface-800 rounded animate-pulse" />
            <div className="h-10 bg-surface-800 rounded animate-pulse" />
            <div className="h-10 bg-surface-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-surface-50">Settings</h1>
        <p className="text-sm text-surface-500 mt-0.5">Manage your account and profile</p>
      </div>

      {/* ── Account overview ── */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-500/20 border-2 border-brand-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-brand-400">
            {profile ? getInitials(profile.full_name) : '?'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-surface-50 truncate">{profile?.full_name ?? '—'}</p>
          <p className="text-sm text-surface-500 truncate">{profile?.email ?? '—'}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="badge bg-brand-500/15 text-brand-300 text-xs">
              {profile ? USER_ROLE_LABELS[profile.role] : '—'}
            </span>
            {profile?.welder_stamp && (
              <span className="badge bg-surface-700 text-surface-400 text-xs font-mono">
                Stamp: {profile.welder_stamp}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Profile settings ── */}
      <Section icon={User} title="Profile">
        <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input {...profileForm.register('full_name')} className="input" />
            {profileForm.formState.errors.full_name && (
              <p className="field-error">{profileForm.formState.errors.full_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input
                {...profileForm.register('phone')}
                className="input"
                placeholder="+1 (555) 000-0000"
                type="tel"
              />
            </div>
            <div>
              <label className="label">Welder Stamp</label>
              <input
                {...profileForm.register('welder_stamp')}
                className="input font-mono uppercase"
                placeholder="e.g. RK42"
                maxLength={10}
              />
              <p className="text-xs text-surface-600 mt-1">
                Your certification stamp — appears on all welds you log
              </p>
            </div>
          </div>

          {profileError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {profileError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={profileForm.formState.isSubmitting}
              className="btn-primary flex items-center gap-2"
            >
              {profileForm.formState.isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : 'Save Profile'
              }
            </button>
            {profileSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </Section>

      {/* ── Organization info (read-only for now) ── */}
      <Section icon={Building2} title="Organization">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label">Organization ID</p>
              <p className="text-sm font-mono text-surface-400 truncate">
                {profile?.organization_id?.slice(0, 16)}…
              </p>
            </div>
            <div>
              <p className="label">Your Role</p>
              <p className="text-sm text-surface-300">
                {profile ? USER_ROLE_LABELS[profile.role] : '—'}
              </p>
            </div>
          </div>
          <Link
            href="/settings/billing"
            className="flex items-center justify-between p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/15 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-surface-100">Manage Billing</p>
                <p className="text-xs text-surface-500">View plans, invoices, and payment method</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-surface-500 group-hover:text-brand-400 transition-colors" />
          </Link>

          {profile?.role === 'administrator' && (
            <Link
              href="/settings/feedback"
              className="flex items-center justify-between p-4 rounded-xl bg-surface-700/50 border border-surface-700 hover:bg-surface-700 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm font-semibold text-surface-100">User Feedback</p>
                  <p className="text-xs text-surface-500">View star ratings and comments from your team</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-surface-500 group-hover:text-purple-400 transition-colors" />
            </Link>
          )}
        </div>
      </Section>

      {/* ── Change Email — platform_admin only ── */}
      {isPlatformAdmin && (
        <Section icon={Mail} title="Change Email Address">
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300">
              Developer-only setting. Regular users cannot change their email address.
            </p>
          </div>

          <form onSubmit={saveEmail} className="space-y-4">
            <div>
              <label className="label">Current Email</label>
              <input
                value={profile?.email ?? ''}
                disabled
                className="input opacity-50 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="label">New Email Address</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                placeholder="new@email.com"
                className="input"
                autoComplete="off"
              />
              <p className="text-xs text-surface-600 mt-1">
                Updates your login email in Supabase Auth and your profile record.
              </p>
            </div>

            {emailError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {emailError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={emailLoading || !newEmail}
                className="btn-primary flex items-center gap-2"
              >
                {emailLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                  : 'Update Email'
                }
              </button>
              {emailSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-400">
                  <CheckCircle2 className="w-4 h-4" /> Email updated
                </span>
              )}
            </div>
          </form>
        </Section>
      )}

      {/* ── Change password ── */}
      <Section icon={Lock} title="Change Password">
        <form onSubmit={passwordForm.handleSubmit(savePassword)} className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <input
              {...passwordForm.register('newPassword')}
              type="password"
              className="input"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              autoComplete="new-password"
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="field-error">{passwordForm.formState.errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input
              {...passwordForm.register('confirmPassword')}
              type="password"
              className="input"
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="field-error">{passwordForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {passwordError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
              className="btn-primary flex items-center gap-2"
            >
              {passwordForm.formState.isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                : 'Update Password'
              }
            </button>
            {passwordSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4" /> Password updated
              </span>
            )}
          </div>
        </form>
      </Section>

    </div>
  )
}

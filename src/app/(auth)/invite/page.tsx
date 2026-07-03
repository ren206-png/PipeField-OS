'use client'
// ============================================================
// /invite — Invited user completes their account setup.
// Reads ?token=... from the URL, validates it, then shows
// a signup form pre-filled with their email and org info.
// On submit, calls /api/register with the invite token.
// ============================================================
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface InviteInfo {
  email:    string
  role:     string
  org_name: string
  org_id:   string
}

const ROLE_LABELS: Record<string, string> = {
  organization_owner: 'Organization Owner',
  administrator:      'Administrator',
  project_manager:    'Project Manager',
  foreman:            'Foreman',
  qa_inspector:       'QA/QC Inspector',
  shop_fabricator:    'Shop Fabricator',
  pipefitter:         'Pipefitter',
  client_viewer:      'Client Viewer',
}

function InvitePageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const supabase     = createClient()

  const token = searchParams.get('token') ?? ''

  const [invite,      setInvite]      = useState<InviteInfo | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)

  const [fullName,  setFullName]  = useState('')
  const [password,  setPassword]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [authError,  setAuthError]  = useState<string | null>(null)

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setInviteError('No invite token found. Please use the link from your email.')
      setLoading(false)
      return
    }

    fetch(`/api/organization/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setInviteError(data.error)
        } else {
          setInvite({
            email:    data.email,
            role:     data.role,
            org_name: data.org_name,
            org_id:   data.org_id,
          })
        }
      })
      .catch(() => setInviteError('Failed to validate invite. Please try again.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return

    setSubmitting(true)
    setAuthError(null)

    // 1. Create Supabase auth account
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email:    invite.email,
      password,
      options:  { data: { full_name: fullName } },
    })

    if (signUpError || !authData.user) {
      setAuthError(signUpError?.message ?? 'Signup failed')
      setSubmitting(false)
      return
    }

    // 2. Complete profile via register route (invite path)
    const res = await fetch('/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        authUserId:  authData.user.id,
        email:       invite.email,
        fullName,
        inviteToken: token,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setAuthError(body.error ?? 'Failed to complete signup')
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-950">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-2xl">
            ⚠️
          </div>
          <h1 className="text-lg font-bold text-surface-50">Invalid Invite</h1>
          <p className="text-sm text-surface-400">{inviteError}</p>
          <a href="/register" className="btn-primary inline-block text-sm">
            Create a new account
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-950">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center">
          <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center shadow-glow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-surface-50">PipeField OS</span>
        </div>

        {/* Invite card */}
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-5 py-4 text-center">
          <p className="text-xs text-surface-500 mb-1">You've been invited to join</p>
          <p className="text-base font-bold text-surface-50">{invite?.org_name}</p>
          <p className="text-xs text-brand-400 mt-1">as {ROLE_LABELS[invite?.role ?? ''] ?? invite?.role}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Email</label>
            <input
              value={invite?.email ?? ''}
              disabled
              className="input w-full opacity-60 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="Your full name"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Create Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="input w-full"
            />
          </div>

          {authError && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{authError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !fullName || !password}
            className="btn-primary w-full"
          >
            {submitting ? 'Creating account…' : 'Join Organization'}
          </button>
        </form>

        <p className="text-xs text-center text-surface-600">
          Already have an account?{' '}
          <a href="/login" className="text-brand-400 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense>
      <InvitePageInner />
    </Suspense>
  )
}

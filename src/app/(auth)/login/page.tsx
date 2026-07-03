// ============================================================
// Login Page — with full diagnostic error display
// ============================================================
'use client'

import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle2, Bug } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email:    z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

function LoginForm() {
  const searchParams = useSearchParams()
  const rawRedirect  = searchParams.get('redirect') ?? '/dashboard'
  const redirectTo   = rawRedirect.startsWith('/') ? rawRedirect : '/dashboard'

  const [showPassword, setShowPassword]   = useState(false)
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [success,      setSuccess]        = useState(false)

  // We now store the FULL Supabase error object for diagnosis
  const [errorMsg,     setErrorMsg]       = useState<string | null>(null)
  const [errorCode,    setErrorCode]      = useState<string | null>(null)
  const [debugInfo,    setDebugInfo]      = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setIsSubmitting(true)
    setErrorMsg(null)
    setErrorCode(null)
    setDebugInfo(null)

    try {
      const supabase = createClient()

      // Race against a 10-second timeout so the button never spins forever
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sign-in timed out. Please check your connection and try again.')), 20_000)
      )

      const { data: authData, error } = await Promise.race([
        supabase.auth.signInWithPassword({
          email:    data.email.trim(),
          password: data.password,
        }),
        timeoutPromise,
      ])

      if (error) {
        // Show the EXACT error Supabase returns — nothing hidden
        setErrorMsg(error.message)
        setErrorCode(error.status?.toString() ?? error.name ?? 'unknown')
        setDebugInfo(JSON.stringify({ message: error.message, status: error.status, name: error.name }, null, 2))
        setIsSubmitting(false)
        return
      }

      if (!authData.session) {
        // Signed up but email not yet confirmed — very common
        setErrorMsg('Email confirmation required. Check your inbox and click the confirmation link, then try signing in again.')
        setErrorCode('email_not_confirmed')
        setIsSubmitting(false)
        return
      }

      // ✅ Success — hard navigation so middleware sees the new cookie
      setSuccess(true)
      window.location.href = redirectTo

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(`Unexpected error: ${msg}`)
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 animate-fade-in">
        <div className="w-14 h-14 bg-success/20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <p className="text-surface-100 font-semibold">Signed in — loading dashboard…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold text-surface-50 tracking-tight">Welcome back</h2>
        <p className="text-surface-400 text-sm">Sign in to your PipeField OS account</p>
      </div>

      {/* ── Error display — shows exact Supabase message ── */}
      {errorMsg && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/30 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{errorMsg}</p>
              {errorCode && (
                <p className="text-xs text-red-400">Code: {errorCode}</p>
              )}
            </div>
          </div>

          {/* ── Contextual help based on the error ── */}
          {(errorCode === 'email_not_confirmed' || errorMsg.toLowerCase().includes('confirm')) && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm space-y-2">
              <p className="font-semibold">📧 Email confirmation is required</p>
              <p>Supabase sent a confirmation email when you registered. Please:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-300/80">
                <li>Open the email from Supabase</li>
                <li>Click &ldquo;Confirm your email&rdquo;</li>
                <li>Return here and sign in</li>
              </ol>
              <p className="text-xs text-blue-400 pt-1">
                Or: go to your Supabase Dashboard → Authentication → Providers → Email → turn off &ldquo;Confirm email&rdquo; to skip this for development.
              </p>
            </div>
          )}

          {errorMsg.toLowerCase().includes('invalid login') && (
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
              <p className="font-semibold">Wrong email or password</p>
              <p className="text-yellow-300/80 text-xs mt-1">
                If you just registered, check your email for a confirmation link first.
              </p>
            </div>
          )}

          {/* Raw debug block */}
          {debugInfo && (
            <details className="group">
              <summary className="flex items-center gap-2 text-xs text-surface-500 cursor-pointer hover:text-surface-300 transition-colors select-none">
                <Bug className="w-3.5 h-3.5" />
                Show raw error details
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-surface-900 border border-surface-700 text-xs text-surface-400 overflow-x-auto">
                {debugInfo}
              </pre>
            </details>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="label">Email Address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="you@yourcompany.com"
            className={errors.email ? 'input-error' : 'input'}
            {...register('email')}
          />
          {errors.email && <p className="error-message">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="label mb-0">Password</label>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`${errors.password ? 'input-error' : 'input'} pr-12`}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-surface-400 hover:text-surface-200 rounded"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="error-message">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full text-base">
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing in…
            </>
          ) : (
            <><LogIn className="w-4 h-4" /> Sign In</>
          )}
        </button>
      </form>

      {/* Debug helper — visible in development */}
      <div className="pt-2 border-t border-surface-800 space-y-2">
        <p className="text-xs text-surface-600 text-center">Troubleshooting tools</p>
        <div className="flex gap-2">
          <a
            href="/api/debug-auth"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-xs py-2 px-3 rounded-lg bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors border border-surface-700"
          >
            🔍 Check Supabase connection
          </a>
          <Link
            href="/register"
            className="flex-1 text-center text-xs py-2 px-3 rounded-lg bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors border border-surface-700"
          >
            + Create account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <svg className="w-6 h-6 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

// ============================================================
// Login Page
// ============================================================
'use client'

import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Turnstile, TURNSTILE_SITE_KEY } from '@/components/turnstile'
import { friendlyAuthError } from '@/lib/auth/friendly-error'

// Detect Capacitor native environment (used for UI-only decisions)
function isCapacitorNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as typeof window & { Capacitor?: { isNativePlatform(): boolean } })
      .Capacitor?.isNativePlatform()
  )
}

const loginSchema = z.object({
  email:    z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

function LoginForm() {
  const searchParams = useSearchParams()
  const rawRedirect  = searchParams.get('redirect') ?? '/dashboard'
  // Only allow a plain same-origin path. Browsers treat '\' as '/' and strip
  // tabs/newlines, so '/\evil.com' and '/\t/evil.com' both become the
  // protocol-relative '//evil.com'. Reject backslashes and control characters
  // anywhere, and a second '/' right after the leading one.
  // Extract only the pathname to prevent open-redirect via Unicode separators,
  // percent-encoded slashes, or other bypass techniques.
  let redirectTo = '/dashboard'
  try {
    const parsed = new URL(rawRedirect, 'https://x')
    if (parsed.hostname === 'x' && parsed.pathname.startsWith('/')) {
      redirectTo = parsed.pathname + parsed.search + parsed.hash
    }
  } catch {
    // malformed — keep default
  }

  const [showPassword, setShowPassword]   = useState(false)
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [success,      setSuccess]        = useState(false)
  const [captchaToken, setCaptchaToken]   = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  // Never block on native iOS — Turnstile isn't rendered there
  const captchaMissing = !isCapacitorNative() && TURNSTILE_SITE_KEY !== '' && captchaToken === null

  const [errorMsg,     setErrorMsg]       = useState<string | null>(null)
  const [needsConfirm, setNeedsConfirm]   = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setIsSubmitting(true)
    setErrorMsg(null)
    setNeedsConfirm(false)

    try {
      const supabase = createClient()

      // Race against a 20-second timeout so the button never spins forever
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sign-in timed out. Please check your connection and try again.')), 20_000)
      )

      // Only pass a real token — not the load-failed sentinel
      const captcha = (captchaToken && captchaToken !== '__load_failed__') ? { captchaToken } : {}
      const { data: authData, error } = await Promise.race([
        supabase.auth.signInWithPassword({
          email:    data.email.trim(),
          password: data.password,
          options:  captcha,
        }),
        timeoutPromise,
      ])
      setCaptchaResetKey(k => k + 1)

      if (error) {
        // Raw details stay in the console; users get a plain-language message
        console.error('Sign-in failed', { message: error.message, status: error.status, code: error.code })
        const friendly = friendlyAuthError(error)
        setErrorMsg(friendly.message)
        setNeedsConfirm(friendly.needsConfirm)
        setIsSubmitting(false)
        return
      }

      if (!authData.session) {
        // Signed up but email not yet confirmed
        setErrorMsg('Please confirm your email address before signing in.')
        setNeedsConfirm(true)
        setIsSubmitting(false)
        return
      }

      // ✅ Success — write session cookies via HTTP Set-Cookie header.
      // WKWebView delays syncing JS-set cookies (document.cookie) to its HTTP
      // cookie store. By POSTing the tokens to an API route first, the server
      // returns Set-Cookie headers that ARE immediately available to the next
      // HTTP request — so when we navigate to /dashboard, middleware sees the
      // session and lets the user through. This fixes "Sign In does not proceed"
      // on iOS (Apple rejection guideline 2.1a).
      setSuccess(true)
      try {
        await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
          }),
        })
      } catch {
        // Non-fatal: cookies may already be set via document.cookie.
        // Navigation will still succeed if middleware can read them.
      }
      window.location.href = redirectTo

    } catch (err: unknown) {
      console.error('Sign-in error', err)
      const msg = err instanceof Error ? err.message : ''
      setErrorMsg(msg.startsWith('Sign-in timed out')
        ? msg
        : 'Something went wrong signing in. Please check your connection and try again.')
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

      {errorMsg && (
        <div className="space-y-3">
          <div role="alert" className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/30 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="font-semibold">{errorMsg}</p>
          </div>

          {needsConfirm && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm space-y-2">
              <p className="font-semibold">📧 Check your inbox</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-300/80">
                <li>Open the confirmation email we sent when you registered</li>
                <li>Click &ldquo;Confirm your email&rdquo;</li>
                <li>Return here and sign in</li>
              </ol>
            </div>
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

        {!isCapacitorNative() && <Turnstile onToken={setCaptchaToken} resetKey={captchaResetKey} />}

        <button type="submit" disabled={isSubmitting || captchaMissing} className="btn-primary w-full text-base">
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

      {/* Account creation — hidden on native iOS per App Store guideline 3.1.1.
          B2B enterprise accounts are created on the web at pipefield-os.com. */}
      {isCapacitorNative() ? (
        <div className="pt-2 border-t border-surface-800 text-center">
          <p className="text-xs text-surface-500">
            New to PipeField OS?{' '}
            <span className="text-surface-400">
              Visit <span className="text-brand-400">pipefield-os.com</span> to create your account.
            </span>
          </p>
        </div>
      ) : (
        <div className="pt-2 border-t border-surface-800 text-center">
          <p className="text-xs text-surface-500">
            New to PipeField OS?{' '}
            <Link href="/register" className="text-brand-400 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      )}
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

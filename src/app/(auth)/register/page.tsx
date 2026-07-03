// ============================================================
// Register Page
// Creates a new organization + admin user in one flow.
// Step 1: Organization details
// Step 2: Admin user details
// ============================================================
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
// useRouter removed — we use window.location.href for hard navigation after sign-up
import { Eye, EyeOff, Building2, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/utils'

const registerSchema = z.object({
  organizationName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name is too long'),
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Name is too long'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const orgName = watch('organizationName', '')
  const orgSlug = slugify(orgName)

  async function onSubmit(data: RegisterFormData) {
    setIsSubmitting(true)
    setAuthError(null)

    // Step 1: Create the Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          organization_name: data.organizationName,
        },
      },
    })

    if (authError) {
      setAuthError(authError.message)
      setIsSubmitting(false)
      return
    }

    if (!authData.user) {
      setAuthError('Account creation failed. Please try again.')
      setIsSubmitting(false)
      return
    }

    // Steps 2 & 3: Create org + profile via server-side API route
    // (uses service role key to bypass RLS — needed for new users)
    const res = await fetch('/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        authUserId:       authData.user.id,
        email:            data.email,
        fullName:         data.fullName,
        organizationName: data.organizationName,
      }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setAuthError(body.error ?? 'Organization setup failed. Please try again.')
      setIsSubmitting(false)
      return
    }

    setSuccess(true)
    // Hard navigation — forces a full browser reload so the server
    // picks up the new Supabase session cookie correctly.
    setTimeout(() => { window.location.href = '/onboarding' }, 1500)
  }

  if (success) {
    return (
      <div className="text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-surface-50">Organization Created!</h2>
        <p className="text-surface-400 text-sm">
          Taking you to your dashboard…
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-surface-50 tracking-tight">
          Create your organization
        </h2>
        <p className="text-surface-400 text-sm">
          Set up PipeField OS for your company. You&apos;ll be the administrator.
        </p>
      </div>

      {authError && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/30 text-red-300 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{authError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Organization Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-500 uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            Organization
          </div>

          <div>
            <label htmlFor="organizationName" className="label">
              Company / Organization Name
            </label>
            <input
              id="organizationName"
              type="text"
              placeholder="ABC Mechanical Inc"
              className={errors.organizationName ? 'input-error' : 'input'}
              {...register('organizationName')}
            />
            {errors.organizationName ? (
              <p className="error-message">{errors.organizationName.message}</p>
            ) : orgSlug ? (
              <p className="text-xs text-surface-500 mt-1">
                Workspace: <span className="text-surface-400 font-mono">{orgSlug}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Admin User Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-surface-500 uppercase tracking-wider">
            <UserPlus className="w-3.5 h-3.5" />
            Administrator Account
          </div>

          <div>
            <label htmlFor="fullName" className="label">Full Name</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Renner Kargbo"
              className={errors.fullName ? 'input-error' : 'input'}
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="error-message">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="label">Work Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              placeholder="you@company.com"
              className={errors.email ? 'input-error' : 'input'}
              {...register('email')}
            />
            {errors.email && (
              <p className="error-message">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
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
            {errors.password && (
              <p className="error-message">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label">Confirm Password</label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                className={`${errors.confirmPassword ? 'input-error' : 'input'} pr-12`}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-surface-400 hover:text-surface-200 rounded"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="error-message">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full text-base"
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating organization…
            </>
          ) : (
            'Create Organization & Get Started'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-surface-400">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}

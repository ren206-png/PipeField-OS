// ============================================================
// env.ts — Runtime environment variable validation
// Import this at the top of any file that reads process.env.
// Throws at module load time if required vars are missing,
// giving a clear error instead of a silent runtime failure.
// ============================================================

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[PipeField OS] Missing required environment variable: ${name}\n` +
      `Add it to .env.local (dev) or your Vercel project settings (prod).\n` +
      `See .env.local.example for all required variables.`
    )
  }
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

// ── Supabase ─────────────────────────────────────────────────
export const SUPABASE_URL      = required('NEXT_PUBLIC_SUPABASE_URL')
export const SUPABASE_ANON_KEY = required('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// Service role — server-side only, NEVER export to the client bundle.
// Validated lazily so it only throws when an admin route is actually called,
// not at module import time (which would break the client bundle).
export function requireServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY')
}

// ── Stripe ───────────────────────────────────────────────────
// Validated lazily (only when billing routes are called) so
// non-billing environments (staging, dev) don't hard-fail.
export function requireStripeKey(): string {
  return required('STRIPE_SECRET_KEY')
}
export function requireStripeWebhookSecret(): string {
  return required('STRIPE_WEBHOOK_SECRET')
}

// ── App URLs ─────────────────────────────────────────────────
export const APP_URL = optional(
  'NEXT_PUBLIC_APP_URL',
  process.env.NODE_ENV === 'production'
    ? 'https://pipefield-os.vercel.app'
    : 'http://localhost:3000'
)

export const APP_NAME = optional('NEXT_PUBLIC_APP_NAME', 'PipeField OS')

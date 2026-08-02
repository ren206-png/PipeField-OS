// ============================================================
// Next.js Instrumentation Hook
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Runs once on server startup — before any requests are handled.
// Used here to initialise Sentry error tracking when SENTRY_DSN is set.
//
// To enable Sentry:
//   1. npm install @sentry/nextjs
//   2. Add SENTRY_DSN=https://... to your .env.local / Vercel env vars
//   3. Run `npx @sentry/wizard@latest -i nextjs` to finish wiring
//      (it patches next.config.mjs and creates sentry.*.config.ts files)
// ============================================================

export async function register() {
  // No-op when DSN is absent — safe to deploy without Sentry configured.
  if (!process.env.SENTRY_DSN) return

  const sentryConfig = {
    dsn:              process.env.SENTRY_DSN,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    environment:      process.env.NODE_ENV,
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic require so TypeScript does not resolve the module at build time
    // (the package may not be installed yet). Cast to any is intentional here.
    try {
      const Sentry = require('@sentry/nextjs') as any
      Sentry.init(sentryConfig)
    } catch {
      // Package not installed — install with: npm install @sentry/nextjs
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    try {
      const Sentry = require('@sentry/nextjs') as any
      Sentry.init(sentryConfig)
    } catch {
      // Package not installed — install with: npm install @sentry/nextjs
    }
  }
}

// ============================================================
// /delete-account — public account-deletion page
// Required by Google Play ("Delete account URL") and linked from the
// privacy policy. Reachable logged out (see PUBLIC_ROUTES in middleware).
// ============================================================
import Link from 'next/link'
import { Flame, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { SITE_URL } from '@/lib/site-url'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How to delete your PipeField OS account and what data is removed or kept.',
  alternates: { canonical: `${SITE_URL}/delete-account` },
}

const SUPPORT_EMAIL = 'rencoenterprise25@gmail.com'

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>
}) {
  const { done } = await searchParams

  return (
    <main className="min-h-screen bg-surface-950 text-surface-200">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200">
          <ArrowLeft className="w-4 h-4" /> PipeField OS
        </Link>

        <header className="space-y-2">
          <div className="flex items-center gap-2 text-brand-400">
            <Flame className="w-5 h-5" aria-hidden="true" />
            <span className="text-sm font-semibold uppercase tracking-wide">PipeField OS by Renco Technologies</span>
          </div>
          <h1 className="text-3xl font-bold text-surface-50">Delete your account</h1>
        </header>

        {done === '1' && (
          <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>Your account has been deleted and you have been signed out.</p>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-surface-50">In the app or on the website</h2>
          <ol className="list-decimal pl-5 space-y-1 text-surface-300">
            <li>Sign in to PipeField OS (Android, iPhone or pipefield-os.com).</li>
            <li>Open <strong>Settings</strong>.</li>
            <li>Scroll to <strong>Delete Account</strong>, choose <strong>Delete my account</strong>, type DELETE and confirm.</li>
          </ol>
          <p className="text-surface-400">Deletion is immediate and signs you out on all devices.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-surface-50">Can&apos;t sign in?</h2>
          <p className="text-surface-300">
            Email <a className="text-brand-400 underline" href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20PipeField%20OS%20account`}>{SUPPORT_EMAIL}</a>{' '}
            from the address on your account with the subject &ldquo;Delete my PipeField OS account&rdquo;.
            We confirm it&apos;s you and delete the account within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-surface-50">What is deleted</h2>
          <ul className="list-disc pl-5 space-y-1 text-surface-300">
            <li>Your login (you can&apos;t sign in again)</li>
            <li>Your name, email address, phone number, welder stamp and profile photo</li>
            <li>Your personal work log, notifications and notification subscriptions</li>
            <li>If you are the only member of your company: its subscription is cancelled</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-surface-50">What is kept, and why</h2>
          <p className="text-surface-300">
            Quality records you created for your company — such as welds, NDE results, inspections,
            signatures and turnover packages — belong to that company and are kept, shown as
            &ldquo;Deleted user&rdquo;. Piping codes (for example ASME B31.3) and project contracts
            require these records to be retained. Your company&apos;s administrator can ask us to delete
            the company&apos;s data by email.
          </p>
          <p className="text-surface-400 text-sm">
            Backups are overwritten on a rolling basis. See the <Link className="underline" href="/privacy">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </main>
  )
}

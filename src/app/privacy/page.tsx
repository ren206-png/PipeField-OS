// ============================================================
// /privacy — Privacy Policy
// ============================================================
import Link from 'next/link'
import { Flame, ArrowLeft } from 'lucide-react'
import { SITE_URL } from '@/lib/site-url'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How PipeField OS collects, uses, and protects your personal information.',
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
  robots: {
    index: true,
    follow: true,
  },
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-bold text-surface-50 border-b border-surface-800 pb-2">{title}</h2>
      <div className="space-y-3 text-surface-400 leading-relaxed">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  const lastUpdated = '2026-07-17'

  return (
    <div className="min-h-screen bg-surface-900 text-surface-100 font-sans">

      {/* Nav */}
      <nav className="border-b border-surface-800 bg-surface-900/90 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-brand-500" />
          <span className="font-bold text-surface-50">PipeField OS</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16 space-y-10">

        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-50">Privacy Policy</h1>
          <p className="text-sm text-surface-500">Last updated: {lastUpdated}</p>
        </div>

        {/* 1 — Who We Are */}
        <Section id="who-we-are" title="1. Who We Are">
          <p>
            PipeField OS (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is a software
            platform for pipeline construction quality control and field tools, operated by{' '}
            Renco Enterprise, based in Alberta, Canada.
          </p>
          <p>
            This Privacy Policy explains how we collect, use, disclose, and safeguard your
            information when you use our platform at <strong>pipefield-os.com</strong> and any
            related mobile or desktop applications.
          </p>
        </Section>

        {/* 2 — Data We Collect */}
        <Section id="data-collected" title="2. Data We Collect">
          <p>We collect the following categories of information:</p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong className="text-surface-300">Account data:</strong> Name, email address,
              company/organization name, job role.
            </li>
            <li>
              <strong className="text-surface-300">Project &amp; work data:</strong> Weld records,
              spool data, NDE reports, QA packages, and other pipeline construction data you enter
              into the platform.
            </li>
            <li>
              <strong className="text-surface-300">Usage data:</strong> Pages visited, features
              used, timestamps, IP address, browser type, and device identifiers.
            </li>
            <li>
              <strong className="text-surface-300">Payment data:</strong> Billing name, address,
              and last four digits of card. Full card numbers are processed by Stripe and never
              stored by us.
            </li>
            <li>
              <strong className="text-surface-300">Uploaded files:</strong> Photos, PDFs, drawings,
              and other documents you upload to the platform in connection with your projects.
            </li>
            <li>
              <strong className="text-surface-300">Communications:</strong> Emails or support
              messages you send us.
            </li>
          </ul>
        </Section>

        {/* 3 — How We Use Your Data */}
        <Section id="how-we-use" title="3. How We Use Your Data">
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Provide, operate, and maintain the PipeField OS platform</li>
            <li>Process payments and manage your subscription</li>
            <li>Send transactional emails (account confirmation, password reset, billing receipts)</li>
            <li>Send product updates and feature announcements (you may opt out at any time)</li>
            <li>Monitor platform security and prevent abuse</li>
            <li>Improve the platform through aggregated, anonymised analytics</li>
            <li>Comply with legal obligations under applicable Canadian law (PIPEDA)</li>
          </ul>
        </Section>

        {/* 4 — Data Retention */}
        <Section id="retention" title="4. Data Retention">
          <p>
            We retain your account and project data for as long as your account is active, plus
            30 days after account closure to allow for data export and dispute resolution.
          </p>
          <p>
            You may request deletion of your data at any time by contacting us at{' '}
            <a href="mailto:support@pipefield-os.com" className="text-brand-400 hover:underline">
              support@pipefield-os.com
            </a>. Some data may be retained longer where required by law or for legitimate business
            purposes (e.g. financial records).
          </p>
        </Section>

        {/* 5 — Sub-processors */}
        <Section id="subprocessors" title="5. Sub-Processors & Third Parties">
          <p>
            We share your data only with the third-party services (&ldquo;sub-processors&rdquo;)
            required to operate the platform:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left py-2 pr-4 text-surface-300 font-semibold">Provider</th>
                  <th className="text-left py-2 pr-4 text-surface-300 font-semibold">Purpose</th>
                  <th className="text-left py-2 text-surface-300 font-semibold">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                <tr>
                  <td className="py-2 pr-4 text-surface-300">Supabase</td>
                  <td className="py-2 pr-4">Database, authentication, file storage</td>
                  <td className="py-2">USA (AWS us-east-1)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-surface-300">Stripe</td>
                  <td className="py-2 pr-4">Payment processing</td>
                  <td className="py-2">USA</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-surface-300">Resend</td>
                  <td className="py-2 pr-4">Transactional email</td>
                  <td className="py-2">USA</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-surface-300">OpenAI</td>
                  <td className="py-2 pr-4">AI-powered knowledge search (PipeField Intelligence)</td>
                  <td className="py-2">USA</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-surface-300">Vercel</td>
                  <td className="py-2 pr-4">Hosting &amp; edge compute</td>
                  <td className="py-2">Global CDN</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-surface-300">Google Analytics</td>
                  <td className="py-2 pr-4">Anonymised usage analytics</td>
                  <td className="py-2">USA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 6 — Your Rights */}
        <Section id="your-rights" title="6. Your Rights">
          <p>Under PIPEDA and applicable Canadian privacy law, you have the right to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent at any time where processing is based on consent</li>
            <li>File a complaint with the Office of the Privacy Commissioner of Canada</li>
          </ul>
          <p>
            To exercise any of these rights, contact{' '}
            <a href="mailto:support@pipefield-os.com" className="text-brand-400 hover:underline">
              support@pipefield-os.com
            </a>. We will respond within 30 days.
          </p>
        </Section>

        {/* 7 — Cookies */}
        <Section id="cookies" title="7. Cookies & Tracking">
          <p>
            We use essential cookies for authentication session management (via Supabase). We do
            not use advertising cookies or cross-site tracking cookies.
          </p>
          <p>
            We use Google Analytics to collect anonymised usage statistics (pages visited, session
            duration, device type). This data is aggregated and cannot be used to identify you
            individually. You may opt out of Google Analytics by installing the{' '}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline"
            >
              Google Analytics Opt-out Browser Add-on
            </a>.
          </p>
        </Section>

        {/* 8 — Security */}
        <Section id="security" title="8. Security">
          <p>
            We implement industry-standard security controls including TLS encryption in transit,
            row-level security (RLS) on all database tables, and service-role key isolation between
            tenants. However, no system is completely secure and we cannot guarantee absolute
            security.
          </p>
          <p>
            To report a security vulnerability, contact{' '}
            <a href="mailto:support@pipefield-os.com" className="text-brand-400 hover:underline">
              support@pipefield-os.com
            </a>.
          </p>
        </Section>

        {/* 9 — Changes */}
        <Section id="changes" title="9. Changes to This Policy">
          <p>
            We may update this policy from time to time. We will notify you of material changes
            by email and/or by posting a notice on the platform at least 30 days before the
            change takes effect. Continued use after the effective date constitutes acceptance
            of the updated policy.
          </p>
        </Section>

        {/* 10 — Contact */}
        <Section id="contact" title="10. Contact Us">
          <p>For privacy questions or to exercise your rights:</p>
          <address className="not-italic space-y-1 ml-2 mt-2">
            <p className="font-medium text-surface-200">Renco Enterprise</p>
            <p>Alberta, Canada</p>
            <p>
              Email:{' '}
              <a href="mailto:support@pipefield-os.com" className="text-brand-400 hover:underline">
                support@pipefield-os.com
              </a>
            </p>
          </address>
        </Section>

        {/* Footer nav */}
        <div className="pt-8 border-t border-surface-800 flex items-center justify-between text-sm text-surface-500">
          <Link href="/terms" className="hover:text-surface-300 transition-colors">
            Terms of Service →
          </Link>
          <Link href="/" className="hover:text-surface-300 transition-colors">
            ← Back to PipeField OS
          </Link>
        </div>

      </main>
    </div>
  )
}

// ============================================================
// /terms — Terms of Service
//
// SCAFFOLD — Replace all [PLACEHOLDER] sections with
// counsel-reviewed language before publishing.
// Do NOT treat this as legal advice.
// ============================================================
import Link from 'next/link'
import { Flame, ArrowLeft } from 'lucide-react'
import { SITE_URL } from '@/lib/site-url'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms and conditions governing your use of PipeField OS.',
  alternates: {
    canonical: `${SITE_URL}/terms`,
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

function Placeholder({ label }: { label: string }) {
  return (
    <span className="inline-block bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-mono px-2 py-0.5 rounded">
      [PLACEHOLDER: {label}]
    </span>
  )
}

export default function TermsPage() {
  const lastUpdated = '2026-07-04'

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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-50">Terms of Service</h1>
          <p className="text-sm text-surface-500">Last updated: {lastUpdated}</p>
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
            <strong>Notice:</strong> This document contains placeholder sections marked{' '}
            <code className="text-xs bg-yellow-500/20 px-1 rounded">[PLACEHOLDER]</code>. Replace
            all placeholder sections with counsel-reviewed language before publishing. This scaffold
            is not legal advice.
          </div>
        </div>

        {/* 1 — Acceptance */}
        <Section id="acceptance" title="1. Acceptance of Terms">
          <p>
            By accessing or using PipeField OS (&ldquo;the Service&rdquo;), operated by{' '}
            <Placeholder label="Legal entity name" /> (&ldquo;Company&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;, &ldquo;our&rdquo;), you agree to be bound by these Terms of Service
            (&ldquo;Terms&rdquo;). If you do not agree, do not use the Service.
          </p>
          <p>
            By accepting these Terms, you represent that you are at least 18 years of age and have
            the authority to bind yourself or your organization to these Terms.
          </p>
        </Section>

        {/* 2 — Description of Service */}
        <Section id="service" title="2. Description of Service">
          <p>
            PipeField OS is a cloud-based software platform for pipeline construction quality
            control, weld tracking, NDE management, QA documentation, and field calculations.
            The Service is provided on a subscription basis as described on our pricing page.
          </p>
        </Section>

        {/* 3 — Accounts */}
        <Section id="accounts" title="3. Accounts & Organizations">
          <p>
            You must create an account and organization to use the Service. You are responsible
            for maintaining the confidentiality of your credentials and for all activity that
            occurs under your account. Notify us immediately at{' '}
            <Placeholder label="support@yourdomain.com" /> if you suspect unauthorized access.
          </p>
          <p>
            Each account is associated with a single organization. Users you invite to your
            organization are subject to these Terms.
          </p>
        </Section>

        {/* 4 — Acceptable Use */}
        <Section id="acceptable-use" title="4. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Use the Service for any unlawful purpose or in violation of any regulations</li>
            <li>Attempt to gain unauthorized access to any portion of the Service</li>
            <li>Reverse engineer, decompile, or disassemble the Service</li>
            <li>Upload malicious code, viruses, or harmful content</li>
            <li>Use the Service to store or transmit infringing, defamatory, or illegal content</li>
            <li>Resell or sublicense the Service without written authorization</li>
            <li>
              Use the field calculators as a substitute for professional engineering judgment —
              all outputs must be verified by a qualified engineer before use in design or
              construction decisions
            </li>
          </ul>
        </Section>

        {/* 5 — Engineering Disclaimer */}
        <Section id="engineering-disclaimer" title="5. Engineering & Safety Disclaimer">
          <p className="font-semibold text-surface-200">
            THE FIELD CALCULATORS AND ALL TECHNICAL OUTPUTS PROVIDED BY PIPEFIELDS OS ARE FOR
            INFORMATIONAL AND REFERENCE PURPOSES ONLY.
          </p>
          <p>
            All pipe dimensions, fitting allowances, support span values, Barlow&apos;s formula
            results, thermal expansion values, and other technical outputs must be independently
            verified against current editions of applicable standards (ASME B31.3, B31.1, B36.10M,
            B16.9, MSS SP-58, and your project engineering specifications) by a qualified
            Professional Engineer before use in any design, fabrication, or construction decision.
          </p>
          <p>
            We expressly disclaim any liability for loss, injury, or damage arising from reliance
            on the Service&apos;s technical outputs without independent engineering verification.
          </p>
        </Section>

        {/* 6 — Subscriptions & Payment */}
        <Section id="subscriptions" title="6. Subscriptions & Payment">
          <p>
            Paid plans are billed in advance on a monthly or annual basis. All fees are
            non-refundable except as required by law or as described in our refund policy.
          </p>
          <p>
            <Placeholder label="Describe free trial terms if applicable, plan upgrade/downgrade policy, and what happens to data on cancellation" />
          </p>
          <p>
            We reserve the right to change pricing with <Placeholder label="30 days" /> notice.
            Continued use after the effective date constitutes acceptance of the new pricing.
          </p>
        </Section>

        {/* 7 — Data Ownership */}
        <Section id="data-ownership" title="7. Data Ownership">
          <p>
            You retain ownership of all project data, weld records, documents, and other content
            you upload to the Service (&ldquo;Your Data&rdquo;). You grant us a limited license
            to host, store, and process Your Data solely to provide the Service.
          </p>
          <p>
            Upon cancellation, you may export Your Data for{' '}
            <Placeholder label="30 days" /> after your final billing period. After this period,
            Your Data may be deleted in accordance with our retention policy.
          </p>
        </Section>

        {/* 8 — Intellectual Property */}
        <Section id="ip" title="8. Intellectual Property">
          <p>
            The Service, including its software, design, and content (excluding Your Data), is
            owned by <Placeholder label="Legal entity name" /> and protected by copyright,
            trademark, and other intellectual property laws. Nothing in these Terms grants you
            any right to our intellectual property except the limited license to use the Service.
          </p>
        </Section>

        {/* 9 — Limitation of Liability */}
        <Section id="liability" title="9. Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL{' '}
            <Placeholder label="LEGAL ENTITY NAME" /> BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
            SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES,
            WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR
            OTHER INTANGIBLE LOSSES.
          </p>
          <p>
            OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING UNDER THESE TERMS SHALL NOT
            EXCEED THE GREATER OF <Placeholder label="$100 USD OR THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM" />.
          </p>
        </Section>

        {/* 10 — Termination */}
        <Section id="termination" title="10. Termination">
          <p>
            Either party may terminate the agreement at any time. We may suspend or terminate
            your account immediately for material breach of these Terms, including but not limited
            to non-payment or violation of the Acceptable Use policy.
          </p>
        </Section>

        {/* 11 — Governing Law */}
        <Section id="governing-law" title="11. Governing Law">
          <p>
            These Terms shall be governed by the laws of{' '}
            <Placeholder label="Province of Alberta, Canada / State of Texas, USA — choose your jurisdiction" />,
            without regard to conflict of law principles. Any disputes shall be resolved in the
            courts of <Placeholder label="jurisdiction" />.
          </p>
        </Section>

        {/* 12 — Changes */}
        <Section id="changes" title="12. Changes to These Terms">
          <p>
            We may modify these Terms at any time. We will provide{' '}
            <Placeholder label="30 days" /> notice of material changes by email and/or platform
            notification. Continued use after the effective date constitutes acceptance.
          </p>
        </Section>

        {/* 13 — Contact */}
        <Section id="contact" title="13. Contact">
          <address className="not-italic space-y-1 ml-2">
            <p><Placeholder label="Legal entity name" /></p>
            <p>Email: <Placeholder label="legal@yourdomain.com" /></p>
          </address>
        </Section>

        {/* Footer nav */}
        <div className="pt-8 border-t border-surface-800 flex items-center justify-between text-sm text-surface-500">
          <Link href="/privacy" className="hover:text-surface-300 transition-colors">
            ← Privacy Policy
          </Link>
          <Link href="/" className="hover:text-surface-300 transition-colors">
            Back to PipeField OS →
          </Link>
        </div>

      </main>
    </div>
  )
}

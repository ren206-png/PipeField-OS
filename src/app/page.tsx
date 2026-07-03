// ============================================================
// Root Page — /
// Authenticated users → redirect to /dashboard
// Unauthenticated users → marketing landing page
// ============================================================
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Flame,
  Layers,
  ClipboardList,
  FileText,
  BarChart2,
  Bell,
  CheckCircle2,
  ArrowRight,
  Calculator,
  HardHat,
  Building2,
  Wrench,
  Thermometer,
  Weight,
  Ruler,
  MoveHorizontal,
} from 'lucide-react'

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-surface-900 text-surface-50 font-sans scroll-smooth">
      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-surface-800 bg-surface-900/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Flame className="h-7 w-7 text-brand-500" />
              <span className="text-lg font-bold tracking-tight text-surface-50">
                PipeField OS
              </span>
            </div>

            {/* Links */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#for-pipefitters"
                className="text-sm text-brand-400 hover:text-brand-300 font-semibold transition-colors"
              >
                For Pipefitters
              </a>
              <a
                href="#for-companies"
                className="text-sm text-surface-400 hover:text-surface-50 transition-colors"
              >
                For Companies
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-surface-400 hover:text-surface-50 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#contact"
                className="text-sm text-surface-400 hover:text-surface-50 transition-colors"
              >
                Contact
              </a>
              <Link
                href="/blog"
                className="text-sm text-surface-400 hover:text-surface-50 transition-colors"
              >
                Blog
              </Link>
            </div>

            {/* CTA */}
            <Link
              href="/login"
              className="rounded-lg border border-surface-700 bg-surface-800 px-4 py-2 text-sm font-medium text-surface-50 hover:bg-surface-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Orange glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(249,115,22,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            Built for the Field &amp; the Office
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none mb-6">
            One Platform.
            <br />
            <span className="text-brand-500">Two Powerhouses.</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto max-w-2xl text-lg sm:text-xl text-surface-400 leading-relaxed mb-10">
            PipeField OS gives <strong className="text-surface-200">pipefitters</strong> instant
            field calculators and gives <strong className="text-surface-200">pipeline companies</strong>{' '}
            full weld tracking, NDE management, and QA packages — all in one place.
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <a
              href="#for-pipefitters"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-8 py-4 text-base font-semibold text-white shadow-glow hover:bg-brand-600 transition-colors"
            >
              <HardHat className="h-5 w-5" />
              I&apos;m a Pipefitter
            </a>
            <a
              href="#for-companies"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-700 bg-surface-800 px-8 py-4 text-base font-semibold text-surface-50 hover:bg-surface-700 transition-colors"
            >
              <Building2 className="h-5 w-5" />
              I&apos;m a Company / QC Team
            </a>
          </div>

          {/* Sign up link */}
          <div className="mb-14">
            <Link
              href="/register"
              className="text-sm text-surface-500 hover:text-surface-300 transition-colors underline underline-offset-4"
            >
              Create a free account →
            </Link>
          </div>

          {/* Trusted by */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs uppercase tracking-widest text-surface-600 font-semibold">
              Trusted by contractors &amp; field crews
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                'Apex Fabrication',
                'Northern Pipeline Corp',
                'Delta Industrial Services',
                'RenCo Enterprises',
              ].map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-surface-700 bg-surface-800 px-4 py-1.5 text-xs font-medium text-surface-400"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────── */}
      <section className="border-y border-surface-800 bg-surface-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: '6', label: 'Field Calculators' },
              { value: '50,000+', label: 'Welds Tracked' },
              { value: '12 min', label: 'Avg. QA Package Generation' },
              { value: '100%', label: 'Code Compliant Exports' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-brand-500 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-surface-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PIPEFITTER CALCULATORS ──────────────────────────── */}
      <section id="for-pipefitters" className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-14">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-400">
              <HardHat className="h-3.5 w-3.5" />
              For Pipefitters
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-50 mb-4">
              Your field calculators. <span className="text-brand-500">Always with you.</span>
            </h2>
            <p className="mx-auto max-w-xl text-surface-400 text-lg">
              Built by someone who knows the job — no app store, no subscription, works on any
              phone or tablet, even in the field.
            </p>
          </div>

          {/* Calculator cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {[
              {
                Icon: Ruler,
                title: 'Pipe Properties',
                sub:   'OD, Wall, ID lookup',
                desc:  'Instant lookup of outside diameter, wall thickness, and inside diameter for any NPS and schedule.',
              },
              {
                Icon: Wrench,
                title: 'Take-Out & Cut Length',
                sub:   'Fittings & cut length',
                desc:  'Calculate fitting take-outs and exact cut lengths for elbows, tees, reducers, and more.',
              },
              {
                Icon: MoveHorizontal,
                title: 'Offset Calculator',
                sub:   'Simple & rolling offsets',
                desc:  'Solve simple and rolling offsets with travel, spread, and set calculations for any degree of bend.',
              },
              {
                Icon: Weight,
                title: "Pipe Weight & Barlow's",
                sub:   'lb/ft, total weight, min wall',
                desc:  "Compute pipe weight per foot, total run weight, and minimum wall thickness using Barlow's formula.",
              },
              {
                Icon: Thermometer,
                title: 'Thermal Expansion',
                sub:   'ΔL = α × L × ΔT',
                desc:  'Calculate thermal growth for any pipe material, length, and temperature differential — critical for loop sizing.',
              },
              {
                Icon: Calculator,
                title: 'Pipe Support Span',
                sub:   'Max span & hanger load',
                desc:  'Determine maximum support spacing and hanger load per ASME/MSS guidelines for any pipe size and schedule.',
              },
            ].map(({ Icon, title, sub, desc }) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-surface-700 bg-surface-800/60 p-6 hover:border-brand-500/40 hover:bg-surface-800 transition-all duration-200"
              >
                {/* Icon badge */}
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20">
                  <Icon className="h-6 w-6 text-brand-500" />
                </div>
                <h3 className="text-base font-bold text-surface-50 mb-0.5">{title}</h3>
                <p className="text-xs font-medium text-brand-400 mb-3">{sub}</p>
                <p className="text-sm text-surface-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-8 text-center">
            <h3 className="text-xl font-bold text-surface-50 mb-2">
              Try all 6 calculators — free, right now.
            </h3>
            <p className="text-surface-400 mb-6 text-sm">
              No credit card. No installation. Sign up in 30 seconds and start calculating.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-8 py-4 text-base font-semibold text-white shadow-glow hover:bg-brand-600 transition-colors"
            >
              Open the Calculators Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-xs text-surface-500">Works on phone &amp; tablet · No installation</p>
          </div>
        </div>
      </section>

      {/* ── COMPANY / QC TEAM FEATURES ──────────────────────── */}
      <section id="for-companies" className="py-24 bg-surface-950 border-y border-surface-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-surface-600/50 bg-surface-800 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-surface-300">
              <Building2 className="h-3.5 w-3.5" />
              For Pipeline Companies &amp; QC Teams
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-50 mb-4">
              Everything your QC team needs
            </h2>
            <p className="text-surface-400 max-w-2xl mx-auto">
              Purpose-built for pipeline construction — not generic project management.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                Icon: Flame,
                title: 'Weld Tracking',
                description:
                  'Log every weld with welder stamp, NDE results, and status history. Full audit trail for B31.3 compliance.',
              },
              {
                Icon: Layers,
                title: 'Spool Management',
                description:
                  'Track spool fabrication from design to field release with visual status workflow.',
              },
              {
                Icon: ClipboardList,
                title: 'NDE & Inspection',
                description:
                  'Manage RT, UT, MT, and PT results. Automatic fail notifications to your QC team.',
              },
              {
                Icon: FileText,
                title: 'QA Package Generation',
                description:
                  'One-click PDF packages with weld logs, NDE reports, pressure test certs, and MTRs.',
              },
              {
                Icon: BarChart2,
                title: 'Live Reports',
                description:
                  'Welder performance, spool status, progress reports — always up to date.',
              },
              {
                Icon: Bell,
                title: 'Smart Alerts',
                description:
                  'Cert expiry warnings, NDE failures, overdue RFIs — before they become problems.',
              },
            ].map(({ Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-surface-700 bg-surface-800 p-6 hover:border-brand-500/40 hover:shadow-glow transition-all duration-300"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 border border-brand-500/20">
                  <Icon className="h-5 w-5 text-brand-500" />
                </div>
                <h3 className="text-lg font-semibold text-surface-50 mb-2">{title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl border border-surface-600 bg-surface-800 px-8 py-4 text-base font-semibold text-surface-50 hover:bg-surface-700 transition-colors"
            >
              Request Company Access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-50 mb-4">
              From field to handover in one platform
            </h2>
            <p className="text-surface-400 max-w-xl mx-auto">
              Simple workflow that keeps your whole team — pipefitters and QC managers alike — aligned.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-10">
            {[
              {
                step: '1',
                audience: 'Pipefitters',
                title: 'Work smarter in the field',
                description:
                  'Use built-in calculators for offsets, cut lengths, and pipe support sizing right from your phone — no paper tables needed.',
              },
              {
                step: '2',
                audience: 'Everyone',
                title: 'Log & track in real time',
                description:
                  'Welders log welds, inspectors record NDE results, and QC managers see live project status — all in sync.',
              },
              {
                step: '3',
                audience: 'QC Teams',
                title: 'Generate packages instantly',
                description:
                  'One click produces a complete, code-compliant QA handover package ready for the owner.',
              },
            ].map(({ step, audience, title, description }) => (
              <div key={step} className="relative text-center sm:text-left">
                <div
                  className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-extrabold"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(249,115,22,0.2) 0%, rgba(249,115,22,0.05) 100%)',
                    border: '1px solid rgba(249,115,22,0.25)',
                    color: '#f97316',
                  }}
                >
                  {step}
                </div>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
                  {audience}
                </div>
                <h3 className="text-xl font-bold text-surface-50 mb-3">{title}</h3>
                <p className="text-surface-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WELD MAP HIGHLIGHT ──────────────────────────────── */}
      <section className="py-24 bg-surface-950 border-y border-surface-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — text */}
            <div>
              <div className="mb-4 inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-400">
                Weld Map
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-surface-50 mb-5 leading-snug">
                See every weld.
                <br />
                <span className="text-brand-500">Instantly.</span>
              </h2>
              <p className="text-surface-400 leading-relaxed mb-8">
                The interactive weld map gives your team a live view of every spool and weld
                joint — color-coded by status. No more spreadsheets, no more guessing.
              </p>
              <a
                href="#for-companies"
                className="inline-flex items-center gap-2 text-brand-400 font-semibold hover:text-brand-300 transition-colors"
              >
                Explore QC Features
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Right — fake dashboard mockup */}
            <div className="rounded-2xl border border-surface-700 bg-surface-950 p-6 shadow-card-lg">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm font-semibold text-surface-300">
                  Live Weld Map — Line 12A
                </div>
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-surface-700" />
                  <div className="h-3 w-3 rounded-full bg-surface-700" />
                  <div className="h-3 w-3 rounded-full bg-brand-500" />
                </div>
              </div>

              {/* Mini stat row */}
              <div className="grid grid-cols-4 gap-3 mb-8">
                {[
                  { label: 'Welds', value: '142', bg: 'bg-info/15', text: 'text-info', border: 'border-info/20' },
                  { label: 'Pass Rate', value: '89%', bg: 'bg-success/15', text: 'text-success', border: 'border-success/20' },
                  { label: 'NDE Pending', value: '12', bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/20' },
                  { label: 'Failed', value: '3', bg: 'bg-danger/15', text: 'text-danger', border: 'border-danger/20' },
                ].map(({ label, value, bg, text, border }) => (
                  <div
                    key={label}
                    className={`rounded-xl border p-3 text-center ${bg} ${text} ${border}`}
                  >
                    <div className="text-lg font-bold">{value}</div>
                    <div className="text-xs opacity-70 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Fake pipe segments with weld dots */}
              <div className="space-y-5">
                {[
                  {
                    label: 'SP-1001',
                    segments: [
                      { pct: 0, color: 'bg-success' },
                      { pct: 22, color: 'bg-success' },
                      { pct: 44, color: 'bg-success' },
                      { pct: 66, color: 'bg-warning' },
                      { pct: 88, color: 'bg-success' },
                    ],
                  },
                  {
                    label: 'SP-1002',
                    segments: [
                      { pct: 0, color: 'bg-success' },
                      { pct: 18, color: 'bg-danger' },
                      { pct: 36, color: 'bg-surface-600' },
                      { pct: 54, color: 'bg-success' },
                      { pct: 72, color: 'bg-success' },
                      { pct: 90, color: 'bg-warning' },
                    ],
                  },
                  {
                    label: 'SP-1003',
                    segments: [
                      { pct: 0, color: 'bg-surface-600' },
                      { pct: 30, color: 'bg-surface-600' },
                      { pct: 60, color: 'bg-success' },
                      { pct: 85, color: 'bg-success' },
                    ],
                  },
                  {
                    label: 'SP-1004',
                    segments: [
                      { pct: 0, color: 'bg-success' },
                      { pct: 15, color: 'bg-success' },
                      { pct: 30, color: 'bg-success' },
                      { pct: 48, color: 'bg-success' },
                      { pct: 63, color: 'bg-success' },
                      { pct: 78, color: 'bg-warning' },
                      { pct: 93, color: 'bg-surface-600' },
                    ],
                  },
                ].map(({ label, segments }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs font-mono text-surface-500">
                      {label}
                    </span>
                    <div className="relative flex-1 h-6 flex items-center">
                      {/* Pipe bar */}
                      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-700" />
                      {/* Weld dots */}
                      {segments.map(({ pct, color }, i) => (
                        <div
                          key={i}
                          className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-surface-950 z-10 ${color}`}
                          style={{ left: `${pct}%` }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-surface-800">
                {[
                  { color: 'bg-success', label: 'Passed' },
                  { color: 'bg-warning', label: 'Pending NDE' },
                  { color: 'bg-danger', label: 'Failed' },
                  { color: 'bg-surface-600', label: 'Not Inspected' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-surface-500">
                    <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-surface-50 mb-4">
              Trusted by the field and the office
            </h2>
            <p className="text-surface-400 max-w-xl mx-auto">
              Whether you&apos;re swinging a wrench or managing compliance, PipeField OS delivers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Pipefitter testimonial */}
            <div
              className="rounded-2xl p-px"
              style={{
                background:
                  'linear-gradient(135deg, rgba(249,115,22,0.4) 0%, rgba(249,115,22,0.1) 50%, rgba(249,115,22,0.4) 100%)',
              }}
            >
              <div className="rounded-2xl bg-surface-900 px-7 py-9 h-full flex flex-col">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-400 self-start">
                  <HardHat className="h-3 w-3" />
                  Pipefitter
                </div>
                <div className="text-4xl text-brand-500/30 font-serif leading-none select-none mb-2" aria-hidden>
                  &ldquo;
                </div>
                <blockquote className="text-lg font-medium text-surface-100 leading-relaxed mb-5 flex-1">
                  The offset calculator alone saves me 20 minutes a day. I used to carry a
                  dog-eared cheat sheet — now I just pull up PipeField on my phone.
                </blockquote>
                <cite className="not-italic text-sm text-surface-400 font-medium">
                  — Journeyman Pipefitter, Apex Fabrication
                </cite>
              </div>
            </div>

            {/* QC Manager testimonial */}
            <div
              className="rounded-2xl p-px"
              style={{
                background:
                  'linear-gradient(135deg, rgba(100,116,139,0.4) 0%, rgba(100,116,139,0.1) 50%, rgba(100,116,139,0.4) 100%)',
              }}
            >
              <div className="rounded-2xl bg-surface-900 px-7 py-9 h-full flex flex-col">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-surface-600/50 bg-surface-800 px-3 py-1 text-xs font-bold uppercase tracking-widest text-surface-300 self-start">
                  <Building2 className="h-3 w-3" />
                  QC Manager
                </div>
                <div className="text-4xl text-surface-500/30 font-serif leading-none select-none mb-2" aria-hidden>
                  &ldquo;
                </div>
                <blockquote className="text-lg font-medium text-surface-100 leading-relaxed mb-5 flex-1">
                  PipeField OS replaced 4 separate spreadsheets for us. Our QC documentation
                  time dropped by 60% and our handover packages are audit-ready from day one.
                </blockquote>
                <cite className="not-italic text-sm text-surface-400 font-medium">
                  — Site QC Manager, Northern Pipeline Corp
                </cite>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA BANNER ────────────────────────────────── */}
      <section className="py-24 bg-surface-950 border-y border-surface-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 justify-center mb-10">
            <div className="flex items-center gap-1.5 text-sm text-surface-400">
              <CheckCircle2 className="h-4 w-4 text-success" />
              No credit card required
            </div>
            <div className="flex items-center gap-1.5 text-sm text-surface-400">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Set up in under 10 minutes
            </div>
            <div className="flex items-center gap-1.5 text-sm text-surface-400">
              <CheckCircle2 className="h-4 w-4 text-success" />
              B31.3 compliant exports
            </div>
            <div className="flex items-center gap-1.5 text-sm text-surface-400">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Works on any device
            </div>
          </div>

          <h3 className="text-3xl sm:text-4xl font-bold text-surface-50 mb-4">
            Ready to get started?
          </h3>
          <p className="text-surface-400 mb-10 text-lg">
            Whether you&apos;re a pipefitter looking for field tools or a company building a QC
            program — PipeField OS has you covered.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-10 py-4 text-base font-semibold text-white shadow-glow hover:bg-brand-600 transition-colors"
            >
              <HardHat className="h-5 w-5" />
              Free Pipefitter Account
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-700 bg-surface-800 px-10 py-4 text-base font-semibold text-surface-50 hover:bg-surface-700 transition-colors"
            >
              <Building2 className="h-5 w-5" />
              Company / QC Access
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer id="contact" className="border-t border-surface-800 bg-surface-900 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-8 items-center">
            {/* Left */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-5 w-5 text-brand-500" />
                <span className="font-bold text-surface-50">PipeField OS</span>
              </div>
              <p className="text-sm text-surface-500">Built for the field.</p>
            </div>

            {/* Center */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 sm:justify-center">
              {[
                { label: 'For Pipefitters', href: '#for-pipefitters' },
                { label: 'For Companies', href: '#for-companies' },
                { label: 'Sign In', href: '/login' },
                { label: 'Privacy', href: '#' },
                { label: 'Contact', href: '#contact' },
              ].map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-sm text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Right */}
            <div className="sm:text-right text-sm text-surface-600">
              © 2026 PipeField OS. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

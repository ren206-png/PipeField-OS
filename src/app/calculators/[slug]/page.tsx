// ============================================================
// /calculators/[slug] — Public SEO landing pages for each calculator
//
// These pages are fully public and indexable. They explain the
// calculation, show a static worked example, and CTA to register.
//
// The interactive calculators live behind auth at:
//   /(dashboard)/calculator  — Pipe Properties, Take-Out, Offset, Weight, Thermal
//   /(dashboard)/pipe-support — Support Span
// ============================================================
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Flame, ArrowRight, Calculator, Lock } from 'lucide-react'
import { SITE_URL } from '@/lib/site-url'
import type { Metadata } from 'next'

// ── Calculator content definitions ───────────────────────────

interface CalcExample {
  inputs: { label: string; value: string }[]
  outputs: { label: string; value: string; highlight?: boolean }[]
  note?: string
}

interface CalcPage {
  slug: string
  h1: string
  metaTitle: string
  metaDescription: string
  intro: string        // 150–250 words, genuinely useful
  formula?: string     // The key formula displayed in a code block
  example: CalcExample
  standardRef?: string // ASME / code reference
  ctaTab?: string      // ?tab= value for the dashboard calculator
}

const CALC_PAGES: CalcPage[] = [
  // ── 1. Pipe Properties ──────────────────────────────────────
  {
    slug: 'pipe-properties',
    h1: 'Pipe Properties Calculator — OD, Wall Thickness & ID by NPS and Schedule',
    metaTitle: 'Pipe Properties Calculator — OD, Wall Thickness & ID',
    metaDescription:
      'Look up pipe outside diameter, wall thickness, and inside diameter by NPS and Schedule. Covers Schedule 40, 80, 160, XXS and custom wall per ASME B36.10M.',
    intro: `Pipe properties — outside diameter (OD), wall thickness, and inside diameter (ID) — are the foundation of every calculation a pipefitter or engineer makes in the field.

ASME B36.10M defines OD and nominal wall thickness for carbon and alloy steel pipe across NPS ⅛ through NPS 80. The OD does not change between schedules; only the wall thickness changes. ID is derived: ID = OD − (2 × wall). This distinction matters when calculating flow area, fitting make-up, and stress intensification factors.

Common mistakes in the field: using nominal bore (NPS) instead of actual OD when calculating offset travel, or confusing schedule numbers (Sch 40, 80, 160) with weight designations (STD, XS, XXS). For NPS 10 and larger, Standard weight and Schedule 40 diverge — a 10-inch Std has a 0.365" wall while 10-inch Sch 40 has a 0.365" wall too (they happen to match at that size), but by NPS 12 they differ.

The calculator covers NPS ⅛ to NPS 24, Schedules 10 through XXS, and common materials including carbon steel (A106), stainless 304/316, chrome-moly, duplex, Hastelloy, and Inconel. Wall tolerance per ASME B36.10M is ±12.5%.`,
    formula: 'ID = OD − (2 × Wall)\nFlow Area (in²) = π/4 × ID²',
    example: {
      inputs: [
        { label: 'NPS', value: '6"' },
        { label: 'Schedule', value: 'Schedule 40' },
        { label: 'Material', value: 'Carbon Steel (A106)' },
      ],
      outputs: [
        { label: 'Outside Diameter (OD)', value: '6.625"' },
        { label: 'Wall Thickness', value: '0.280"', highlight: true },
        { label: 'Inside Diameter (ID)', value: '6.065"', highlight: true },
        { label: 'Flow Area', value: '28.89 in²' },
      ],
      note: 'Values per ASME B36.10M. Wall tolerance is −12.5%/+not specified.',
    },
    standardRef: 'ASME B36.10M — Welded and Seamless Wrought Steel Pipe',
    ctaTab: 'pipe',
  },

  // ── 2. Take-Out & Cut Length ─────────────────────────────────
  {
    slug: 'take-out-cut-length',
    h1: 'Pipe Take-Out & Cut Length Calculator — Fittings, Weld Gap & Spool Fabrication',
    metaTitle: 'Pipe Take-Out & Cut Length Calculator for Fabrication',
    metaDescription:
      'Calculate pipe cut length for any fitting combination. Enter spool run length, fitting types, NPS, and weld gap — get exact cut length for fabrication.',
    intro: `Take-out (T/O) is the dimension from the end of a pipe to the center of a fitting — the amount of pipe length "consumed" by the fitting. Cut length is the field measurement you mark on the pipe before cutting. Getting this wrong by even 1/16" across a multi-piece spool costs material, rework time, and handover delays.

The formula is straightforward: Cut Length = Total Run − Sum of Take-Outs + Allowances. Take-out values come from the fitting's center-to-face (CTF) dimension, which is standardized in ASME B16.9 for butt-weld fittings. Each weld joint also consumes a weld gap (typically 1/8" for socket or butt welds). For a spool with a 90° elbow on each end, you subtract two take-outs and add two weld gaps.

This calculator handles the most common scenario: a pipe spool with a fitting on each end. You choose fitting type (90° LR elbow, 45° elbow, tee, reducer, flange, etc.), NPS, weld gap, and total run — and the calculator returns the exact cut length with fractions rounded to the nearest 1/16". Custom CTF values are supported for non-standard fittings.

This calculation is one of the most repeated tasks in spool fabrication. Doing it on a phone or tablet instead of a dog-eared spreadsheet reduces errors and lets crews move faster without sacrificing accuracy.`,
    formula: 'Cut Length = Run − (T/O_A + T/O_B) + (Weld Gap × Number of Joints)',
    example: {
      inputs: [
        { label: 'NPS', value: '4"' },
        { label: 'Total Run', value: '48"' },
        { label: 'Fitting A', value: '90° LR Elbow' },
        { label: 'Fitting B', value: '90° LR Elbow' },
        { label: 'Weld Gap', value: '1/8"' },
      ],
      outputs: [
        { label: 'Take-Out A (4" 90° LR)', value: '6.000"' },
        { label: 'Take-Out B (4" 90° LR)', value: '6.000"' },
        { label: 'Cut Length', value: '36-1/4"', highlight: true },
        { label: 'Cut Length (decimal)', value: '36.25"' },
      ],
      note: 'CTF values per ASME B16.9. Weld gap added once per joint.',
    },
    standardRef: 'ASME B16.9 — Factory-Made Wrought Butt-Welding Fittings',
    ctaTab: 'takeout',
  },

  // ── 3. Offset Calculator ─────────────────────────────────────
  {
    slug: 'offset-calculator',
    h1: 'Pipe Offset Calculator — Simple & Rolling Offsets for Any Fitting Angle',
    metaTitle: 'Pipe Offset Calculator — Simple & Rolling Offsets',
    metaDescription:
      'Calculate pipe offset travel, run, and diagonal for simple and rolling offsets. Supports 22.5°, 30°, 45°, 60°, 90° and custom angles.',
    intro: `A pipe offset routes around an obstruction by changing elevation or horizontal position using two fittings at the same angle. Calculating offset travel incorrectly means fabricated spools don't fit — a costly mistake on large-bore pipe.

For a simple (single-plane) offset, you know the offset distance and the fitting angle. Travel (the diagonal spool length between fittings) is calculated using trigonometry: Travel = Offset / sin(θ), where θ is the fitting angle. Run (the horizontal distance gained) = Offset / tan(θ). These ratios are why pipefitters memorize the "multiplier" constants: at 45°, Travel = Offset × 1.414; at 22.5°, Travel = Offset × 2.613.

A rolling offset introduces a second plane — the pipe must rise and shift laterally simultaneously. The true offset is the hypotenuse of the set and roll: True Offset = √(Set² + Roll²). Travel is then calculated on this true offset using the same single-plane formula.

The calculator handles any angle between 1° and 89°, supports feet-and-inches fractional input, and outputs travel, run, and take-out-adjusted spool length for the most common field and shop scenarios. Results are rounded to the nearest 1/16".`,
    formula: 'Travel = Offset ÷ sin(θ)\nRun = Offset ÷ tan(θ)\nRolling: True Offset = √(Set² + Roll²)',
    example: {
      inputs: [
        { label: 'Mode', value: 'Simple Offset' },
        { label: 'Offset', value: '12"' },
        { label: 'Fitting Angle', value: '45°' },
      ],
      outputs: [
        { label: 'Travel (diagonal)', value: '16-15/16"', highlight: true },
        { label: 'Travel (decimal)', value: '16.971"' },
        { label: 'Run (horizontal gain)', value: '12"' },
        { label: 'Multiplier at 45°', value: '1.414' },
      ],
      note: 'Multiply offset by 1.414 for 45° — a constant every pipefitter should know by heart.',
    },
    ctaTab: 'offset',
  },

  // ── 4. Pipe Weight & Barlow's ────────────────────────────────
  {
    slug: 'pipe-weight-barlows',
    h1: "Pipe Weight Calculator & Barlow's Formula — Weight per Foot and Minimum Wall",
    metaTitle: "Pipe Weight Calculator & Barlow's Formula",
    metaDescription:
      "Calculate pipe weight per foot, total spool weight for rigging, and minimum wall thickness using Barlow's formula for any NPS, schedule, and material.",
    intro: `Two calculations every pipeline crew needs before a lift or hydro test: how heavy is this spool, and is the wall thick enough for the design pressure?

Pipe weight per foot is calculated using the standard formula: W = 10.69 × (OD − Wall) × Wall. The constant 10.69 is a density factor specific to carbon steel; the calculator adjusts this for stainless (10.84), chrome-moly, duplex, Hastelloy, Inconel, and plastic pipe. For riggers and crane operators, you enter the spool run length and the calculator returns total weight — critical for selecting slings and confirming crane capacity.

Barlow's formula determines the minimum wall thickness required to contain a given pressure without exceeding the allowable stress of the pipe material: t_min = (P × OD) / (2 × S × E × Y), where P is design pressure, S is allowable stress from ASME B31.3 Table A-1, E is the quality factor (1.0 for seamless), and Y is the temperature-dependent coefficient. The calculator uses ASME B31.3 allowable stress values at 100°F for common materials. Always confirm with your project's design basis and applicable code edition.`,
    formula: 'W (lb/ft) = 10.69 × (OD − Wall) × Wall\nt_min = (P × OD) ÷ (2 × S × E × Y)',
    example: {
      inputs: [
        { label: 'NPS', value: '8"' },
        { label: 'Schedule', value: 'Schedule 40' },
        { label: 'Material', value: 'Carbon Steel (A106)' },
        { label: 'Run Length', value: '20 ft' },
        { label: 'Design Pressure', value: '600 psi' },
      ],
      outputs: [
        { label: 'Weight per foot', value: '28.55 lb/ft' },
        { label: 'Total spool weight', value: '571 lb', highlight: true },
        { label: 'Min wall (Barlow\'s)', value: '0.088"', highlight: true },
        { label: 'Actual wall (Sch 40)', value: '0.322"' },
      ],
      note: 'Allowable stress per ASME B31.3 Table A-1 at 100°F. Add fluid weight for full hydrotest.',
    },
    standardRef: "ASME B31.3 Table A-1 — Barlow's Formula",
    ctaTab: 'weight',
  },

  // ── 5. Thermal Expansion ─────────────────────────────────────
  {
    slug: 'thermal-expansion',
    h1: 'Pipe Thermal Expansion Calculator — ΔL for Any Material and Temperature Range',
    metaTitle: 'Pipe Thermal Expansion Calculator — ΔL by Material',
    metaDescription:
      'Calculate linear thermal expansion of pipe for any material, run length, and temperature change. Uses ASME B31.3 Table C-1 coefficients for carbon steel, stainless, chrome-moly, and more.',
    intro: `All pipe expands and contracts with temperature change. Failing to account for thermal growth leads to pipe stress, support failures, and fitting leaks. Calculating the expected expansion tells engineers and designers where to place expansion loops, bellows, or sliding supports.

The formula is: ΔL = α × L × ΔT, where α is the material's coefficient of thermal expansion (in/in/°F), L is the pipe run length, and ΔT is the difference between operating temperature and installation temperature. Carbon steel has α ≈ 6.5 × 10⁻⁶ in/in/°F (per ASME B31.3 Table C-1). A 100-foot carbon steel line installed at 70°F and operating at 400°F will expand approximately 2.1 inches — enough to shear an anchor if not accommodated.

This calculator uses ASME B31.3 Table C-1 and C-2 coefficients for carbon steel, stainless 304 and 316, chrome-moly (P11/P22), duplex 2205, Hastelloy C-276, Inconel 625, copper, aluminum, and PVC. Input in feet or inches; temperatures in °F or °C. Output is total linear expansion in inches and millimetres, plus the expansion rate per foot of pipe — useful for quickly scaling to different run lengths.`,
    formula: 'ΔL = α × L × ΔT\nα (carbon steel) = 6.50 × 10⁻⁶ in/in/°F  (ASME B31.3 Table C-1)',
    example: {
      inputs: [
        { label: 'Material', value: 'Carbon Steel (A106)' },
        { label: 'Pipe Run', value: '100 ft' },
        { label: 'Install Temp', value: '70°F' },
        { label: 'Operating Temp', value: '400°F' },
      ],
      outputs: [
        { label: 'Temperature Rise (ΔT)', value: '330°F' },
        { label: 'Thermal Expansion (ΔL)', value: '2.574"', highlight: true },
        { label: 'Expansion per foot', value: '0.026"/ft' },
        { label: 'Expansion (mm)', value: '65.4 mm' },
      ],
      note: 'α = 6.50 × 10⁻⁶ in/in/°F per ASME B31.3 Table C-1. Verify with project design basis.',
    },
    standardRef: 'ASME B31.3 Table C-1 & C-2 — Thermal Expansion Coefficients',
    ctaTab: 'thermal',
  },

  // ── 6. Support Span ──────────────────────────────────────────
  {
    slug: 'support-span',
    h1: 'Pipe Support Span Calculator — Maximum Spacing per ASME & MSS Guidelines',
    metaTitle: 'Pipe Support Span Calculator — Max Spacing per ASME/MSS',
    metaDescription:
      'Calculate maximum pipe support spacing and hanger load per MSS SP-69 and ASME B31.3 guidelines. Covers carbon steel, stainless, and other materials by NPS and schedule.',
    intro: `Pipe hangers and supports must be spaced close enough to prevent excessive sag (which causes stress and puddles in liquid lines) and to keep natural frequency away from pulsation sources. MSS SP-69 and ASME B31.3 Appendix A provide guidance on maximum support spans for common pipe sizes and materials.

Maximum span is primarily governed by allowable sag deflection (typically 0.1" for process lines) and the pipe's section modulus. The formula used in engineering practice is: L_max = √(Z × S_allow / (0.0625 × W_total)), where Z is the pipe's section modulus, S_allow is the allowable bending stress, and W_total is the total distributed load per unit length (pipe self-weight plus fluid plus insulation).

The calculator accepts NPS, schedule, fluid specific gravity, insulation thickness and density, and material — then returns the maximum recommended support spacing and the hanger point load for structural steel sizing. This is a first-pass screening tool; final support spacing on process systems must be confirmed by a piping stress engineer using Caesar II or equivalent software.`,
    formula: 'L_max = √(Z × S_allow ÷ (0.0625 × W_total))\nHanger Load = W_total × L_max',
    example: {
      inputs: [
        { label: 'NPS', value: '6"' },
        { label: 'Schedule', value: 'Standard (Sch 40)' },
        { label: 'Material', value: 'Carbon Steel' },
        { label: 'Fluid', value: 'Water (SG = 1.0)' },
        { label: 'Insulation', value: 'None' },
      ],
      outputs: [
        { label: 'Pipe + Fluid Weight', value: '42.3 lb/ft' },
        { label: 'Max Support Span', value: '17 ft', highlight: true },
        { label: 'Hanger Point Load', value: '719 lb', highlight: true },
      ],
      note: 'Per MSS SP-69 Table 1 guidance. Add insulation and operating load for final design.',
    },
    standardRef: 'MSS SP-69 — Pipe Hangers and Supports; ASME B31.3 Appendix A',
  },
]

// ── Routing helpers ───────────────────────────────────────────

export function generateStaticParams() {
  return CALC_PAGES.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = CALC_PAGES.find(p => p.slug === slug)
  if (!page) return {}

  const canonicalUrl = `${SITE_URL}/calculators/${slug}`
  const ogImageUrl   = `${SITE_URL}/og?title=${encodeURIComponent(page.metaTitle)}&subtitle=${encodeURIComponent('Free Online Calculator · PipeField OS')}`

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: canonicalUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: page.metaTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.metaTitle,
      description: page.metaDescription,
      images: [ogImageUrl],
    },
  }
}

// ── Page component ────────────────────────────────────────────

export default async function CalculatorLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = CALC_PAGES.find(p => p.slug === slug)
  if (!page) notFound()

  const registerHref = page.ctaTab
    ? `/register?next=/calculator?tab=${page.ctaTab}`
    : '/register'

  return (
    <div className="min-h-screen bg-surface-900 text-surface-100 font-sans">

      {/* Nav */}
      <nav className="border-b border-surface-800 bg-surface-900/90 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-brand-500" />
          <span className="font-bold text-surface-50">PipeField OS</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/calculators"
            className="hidden sm:block text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            All Calculators
          </Link>
          <Link
            href={registerHref}
            className="rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Use Calculator Free
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-14 space-y-12">

        {/* Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-400">
            <Calculator className="h-3 w-3" />
            Field Calculator
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-50 leading-tight">
            {page.h1}
          </h1>
          {page.standardRef && (
            <p className="text-xs text-surface-500 font-mono">{page.standardRef}</p>
          )}
        </div>

        {/* Introduction */}
        <div className="prose prose-invert prose-sm max-w-none prose-p:text-surface-400 prose-p:leading-relaxed prose-strong:text-surface-200">
          {page.intro.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Formula */}
        {page.formula && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-surface-500">
              Formula
            </h2>
            <pre className="rounded-xl bg-surface-800 border border-surface-700 px-5 py-4 text-sm text-brand-300 font-mono overflow-x-auto whitespace-pre-wrap">
              {page.formula}
            </pre>
          </div>
        )}

        {/* Worked Example */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-surface-50">Worked Example</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Inputs */}
            <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-surface-500">Inputs</p>
              <div className="space-y-2">
                {page.example.inputs.map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4 text-sm">
                    <span className="text-surface-400">{label}</span>
                    <span className="font-mono text-surface-200 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Outputs */}
            <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-surface-500">Results</p>
              <div className="space-y-2">
                {page.example.outputs.map(({ label, value, highlight }) => (
                  <div key={label} className="flex justify-between gap-4 text-sm">
                    <span className={highlight ? 'text-surface-300 font-medium' : 'text-surface-400'}>
                      {label}
                    </span>
                    <span className={`font-mono text-right ${highlight ? 'text-brand-400 font-bold' : 'text-surface-200'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {page.example.note && (
            <p className="text-xs text-surface-500 italic">{page.example.note}</p>
          )}
        </div>

        {/* CTA block */}
        <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-brand-400">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Interactive Calculator</span>
          </div>
          <h2 className="text-2xl font-bold text-surface-50">
            Run this calculation on your own numbers
          </h2>
          <p className="text-surface-400 text-sm max-w-md mx-auto">
            The interactive calculator handles fractions, multiple fitting types, and any NPS.
            Free account — takes under 2 minutes to set up.
          </p>
          <Link
            href={registerHref}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 px-6 py-3 font-semibold text-white transition-colors shadow-glow"
          >
            Use Calculator Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-surface-600">
            No credit card required. Also includes weld tracking, NDE management, and 5 other calculators.
          </p>
        </div>

        {/* Other calculators */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-surface-300">Other Field Calculators</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {CALC_PAGES.filter(p => p.slug !== slug).map(p => (
              <Link
                key={p.slug}
                href={`/calculators/${p.slug}`}
                className="flex items-center gap-2 rounded-xl border border-surface-700 bg-surface-800/40 px-4 py-3 text-sm text-surface-300 hover:text-surface-100 hover:border-surface-600 transition-colors"
              >
                <Calculator className="h-3.5 w-3.5 text-brand-400 flex-shrink-0" />
                {p.metaTitle.split(' — ')[0]}
              </Link>
            ))}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-surface-800 mt-16 py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-sm text-surface-500">
          <Link href="/" className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-brand-500" />
            <span className="font-semibold text-surface-400">PipeField OS</span>
          </Link>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-surface-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-surface-300 transition-colors">Terms</Link>
            <Link href="/register" className="hover:text-surface-300 transition-colors">Get Started</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}

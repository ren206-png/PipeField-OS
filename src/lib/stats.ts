// ============================================================
// stats.ts — Site-wide marketing statistics
//
// ⚠️  ONLY REAL, VERIFIABLE NUMBERS.
//
// Before changing any value:
//   1. Confirm the number is accurate and defensible.
//   2. Note the source / how it was measured in a comment.
//   3. If a stat cannot be verified, set it to null and the
//      UI will omit it rather than display a fabricated value.
//
// Last reviewed: 2026-07-04
// ============================================================

export interface Stat {
  value: string
  label: string
  /** Brief note on how this number was determined. Never shown in UI. */
  source: string
}

export const STATS: Stat[] = [
  {
    value: '6',
    label: 'Field Calculators',
    // Confirmed: Pipe Properties, Take-Out & Cut Length, Offset,
    // Pipe Weight & Barlow's, Thermal Expansion, Pipe Support Span.
    source: 'Count of calculator tabs in /calculator + /pipe-support',
  },
  {
    value: 'B31.3',
    label: 'Aligned Exports',
    // QA packages reference ASME B31.3 section headers. "100% compliant"
    // is not verifiable without third-party certification — replaced with
    // the specific standard we align to.
    source: 'QA package templates reference ASME B31.3 section structure',
  },
  {
    value: 'Red Seal',
    label: 'Built by a Journeyman',
    // The builder holds a Red Seal Journeyman Steamfitter/Pipefitter
    // certificate. This is the primary trust credential.
    source: 'Builder credential — verifiable via Red Seal Program (RSOS)',
  },
  {
    value: '100%',
    label: 'Yours — export any time',
    // Data portability is a confirmed product feature, not a projected metric.
    source: 'Product feature: full data export on every paid plan',
  },
]

// Stats that are NOT yet verifiable and should NOT appear on the site:
// - '50,000+' welds tracked — no telemetry data to support this yet
// - '12 min' avg QA package generation — no benchmarking data collected
// Add these back only when backed by real platform telemetry.
export const PENDING_STATS = [
  { value: '50,000+', label: 'Welds Tracked', reason: 'No telemetry data yet' },
  { value: '12 min',  label: 'Avg. QA Package Generation', reason: 'No benchmark data yet' },
]

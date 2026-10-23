'use client'
// ============================================================
// Field Mode — Dynamic Calculator Route
// Maps params.calculator to the correct calculator component.
// ============================================================
import React from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { SimpleOffsetCalc }       from '@/components/field-mode/calculators/SimpleOffsetCalc'
import { RollingOffsetCalc }      from '@/components/field-mode/calculators/RollingOffsetCalc'
import { ParallelOffsetsCalc }    from '@/components/field-mode/calculators/ParallelOffsetsCalc'
import { CutLengthBwCalc }        from '@/components/field-mode/calculators/CutLengthBwCalc'
import { CutLengthSwCalc }        from '@/components/field-mode/calculators/CutLengthSwCalc'
import { CutLengthThreadedCalc }  from '@/components/field-mode/calculators/CutLengthThreadedCalc'
import { OddAngleCutCalc }        from '@/components/field-mode/calculators/OddAngleCutCalc'
import { TwoHoleFlangeCalc }      from '@/components/field-mode/calculators/TwoHoleFlangeCalc'
import { BranchLayoutCalc }       from '@/components/field-mode/calculators/BranchLayoutCalc'
import { MiterCalc }              from '@/components/field-mode/calculators/MiterCalc'
import { PipeWeightCalc }         from '@/components/field-mode/calculators/PipeWeightCalc'
import { RiggingCalc }            from '@/components/field-mode/calculators/RiggingCalc'
import { StudLookupCalc }         from '@/components/field-mode/calculators/StudLookupCalc'
import { FLAGS } from '@/intelligence/flags'
import { useOrganization } from '@/hooks/useOrganization'
import { requirePlanTier } from '@/lib/billing-access'

// IsoTapCalc: lazy-loaded, SSR disabled (image/camera handling is browser-only)
const IsoTapCalc = dynamic(
  () => import('@/features/iso-tap-calculate/ui/IsoTapCalc').then(m => ({ default: m.IsoTapCalc })),
  { ssr: false, loading: () => <div className="p-8 text-surface-400 text-sm">Loading…</div> },
)

const CALCULATOR_MAP: Record<string, { label: string; Component: React.ComponentType; minTier?: string }> = {
  'simple-offset':    { label: 'Simple Offset',         Component: SimpleOffsetCalc },
  'rolling-offset':   { label: 'Rolling Offset',        Component: RollingOffsetCalc },
  'parallel-offsets': { label: 'Parallel Offsets',      Component: ParallelOffsetsCalc },
  'cut-bw':           { label: 'Cut Length — Butt Weld',Component: CutLengthBwCalc },
  'cut-sw':           { label: 'Cut Length — SW',       Component: CutLengthSwCalc },
  'cut-threaded':     { label: 'Cut Length — Threaded', Component: CutLengthThreadedCalc },
  'odd-angle':        { label: 'Odd-Angle Cut',         Component: OddAngleCutCalc },
  'two-hole-flange':  { label: '2-Hole Flange',         Component: TwoHoleFlangeCalc },
  'branch-layout':    { label: 'Branch Layout',         Component: BranchLayoutCalc },
  'miter':            { label: 'Miter',                 Component: MiterCalc },
  'pipe-weight':      { label: 'Pipe Weight',           Component: PipeWeightCalc },
  'rigging':          { label: 'Rigging',               Component: RiggingCalc },
  'stud-lookup':      { label: 'Stud & Wrench',         Component: StudLookupCalc },
  // ISO Tap-to-Calculate — only registered when flag is ON; Field Pro and above
  ...(FLAGS.PFOS_FIELD_ISO_CALC
    ? { 'iso-tap-calc': { label: 'ISO Tap-to-Calculate', Component: IsoTapCalc, minTier: 'field_pro' } }
    : {}),
}

interface PageProps {
  params: { calculator: string }
}

function UpgradePrompt({ requiredTier }: { requiredTier: string }) {
  const tierLabel: Record<string, string> = {
    field_pro: 'Field Pro', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise',
  }
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-4xl" aria-hidden="true">🔒</div>
      <h2 className="text-surface-100 font-bold text-lg">Upgrade Required</h2>
      <p className="text-surface-400 text-sm max-w-xs">
        ISO Tap-to-Calculate requires a <strong className="text-surface-200">{tierLabel[requiredTier] ?? requiredTier}</strong> plan
        or higher. Upgrade your subscription to access this calculator.
      </p>
      <Link
        href="/settings/billing"
        className="min-h-[56px] px-6 flex items-center rounded-xl bg-brand-500 text-white font-semibold"
      >
        View Plans
      </Link>
    </div>
  )
}

export default function CalculatorPage({ params }: PageProps) {
  const { calculator } = params
  const entry = CALCULATOR_MAP[calculator]
  const { organization, isLoading } = useOrganization()

  if (!entry) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-surface-400">Calculator not found: {calculator}</p>
        <Link href="/calc" className="min-h-[56px] px-6 flex items-center rounded-xl bg-surface-800 text-surface-200 font-semibold">
          Back to Calculators
        </Link>
      </div>
    )
  }

  const { label, Component, minTier } = entry

  // Tier gate — show upgrade prompt if org doesn't meet the minimum tier
  const tierBlocked = !isLoading && minTier
    ? !requirePlanTier(organization, minTier).allowed
    : false

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 bg-surface-950 border-b border-surface-800">
        <Link href="/calc"
          className="min-h-[56px] min-w-[56px] flex items-center justify-center rounded-xl text-surface-300 active:bg-surface-800"
          aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-surface-100">{label}</h1>
      </div>

      {/* Calculator content — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-surface-500 text-sm text-center">Loading…</div>
        ) : tierBlocked ? (
          <UpgradePrompt requiredTier={minTier!} />
        ) : (
          <Component />
        )}
      </div>
    </div>
  )
}

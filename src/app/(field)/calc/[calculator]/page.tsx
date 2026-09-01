'use client'
// ============================================================
// Field Mode — Dynamic Calculator Route
// Maps params.calculator to the correct calculator component.
// ============================================================
import React from 'react'
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
import { useFieldStrings } from '@/lib/field-mode/locale'

const CALCULATOR_MAP: Record<string, { label: string; Component: React.ComponentType }> = {
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
}

interface PageProps {
  params: { calculator: string }
}

export default function CalculatorPage({ params }: PageProps) {
  const { calculator } = params
  const entry = CALCULATOR_MAP[calculator]

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

  const { label, Component } = entry

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
        <Component />
      </div>
    </div>
  )
}

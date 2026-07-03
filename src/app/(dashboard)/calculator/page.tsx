// ============================================================
// Take-Off & Take-Out Calculator — /calculator
// Module 1: Industrial pipe calculation engine.
// Three tabs: Pipe Properties | Take-Out | Offset
// ============================================================
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calculator, Ruler, Scissors, ArrowLeftRight, Info, Weight, Thermometer } from 'lucide-react'
import { PipePropertiesPanel } from '@/components/calculator/PipePropertiesPanel'
import { TakeOutPanel } from '@/components/calculator/TakeOutPanel'
import { OffsetPanel } from '@/components/calculator/OffsetPanel'
import { PipeWeightPanel } from '@/components/calculator/PipeWeightPanel'
import { ThermalExpansionPanel } from '@/components/calculator/ThermalExpansionPanel'
import { cn } from '@/lib/utils'
import type { NpsSize, PipeSchedule, PipeMaterial } from '@/config/pipe-data'

type CalcTab = 'pipe' | 'takeout' | 'offset' | 'weight' | 'thermal'

const TABS: { value: CalcTab; label: string; shortLabel: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'pipe',
    label: 'Pipe Properties',
    shortLabel: 'Pipe',
    icon: Ruler,
    description: 'OD, Wall, ID lookup',
  },
  {
    value: 'takeout',
    label: 'Take-Out & Cut Length',
    shortLabel: 'Take-Out',
    icon: Scissors,
    description: 'Fittings & cut length',
  },
  {
    value: 'offset',
    label: 'Offset Calculator',
    shortLabel: 'Offset',
    icon: ArrowLeftRight,
    description: 'Simple & rolling offsets',
  },
  {
    value: 'weight',
    label: 'Pipe Weight & Barlow\'s',
    shortLabel: 'Weight',
    icon: Weight,
    description: 'lb/ft, total weight, min wall',
  },
  {
    value: 'thermal',
    label: 'Thermal Expansion',
    shortLabel: 'Thermal',
    icon: Thermometer,
    description: 'ΔL = α × L × ΔT',
  },
]

export default function CalculatorPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<CalcTab>('pipe')

  // Honour ?tab=<value> and ?nps=<value> from the URL.
  // ?tab=offset  — opens directly on the Offset tab (sidebar deep-link)
  // ?nps=4       — pre-fills the NPS selector (deep-link from Pipe Reference DB)
  useEffect(() => {
    const tab = searchParams.get('tab') as CalcTab | null
    if (tab && TABS.some(t => t.value === tab)) setActiveTab(tab)

    const npsParam = searchParams.get('nps') as NpsSize | null
    if (npsParam && Object.keys(NPS_DISPLAY).includes(npsParam)) setNps(npsParam)
  }, [searchParams])

  // Shared pipe state — passed to all tabs so they stay in sync
  const [nps, setNps]           = useState<NpsSize>('4')
  const [schedule, setSchedule] = useState<PipeSchedule>('sch_40')
  const [material, setMaterial] = useState<PipeMaterial>('carbon_steel')

  return (
    <div>
      {/* Page header — desktop */}
      <div className="hidden lg:block page-header">
        <h1 className="page-title flex items-center gap-3">
          <span className="w-9 h-9 bg-green-500/15 rounded-xl flex items-center justify-center">
            <Calculator className="w-5 h-5 text-green-400" />
          </span>
          Take-Off Calculator
        </h1>
        <p className="page-subtitle">
          Pipe properties, fitting take-outs, cut lengths, and offset calculations
        </p>
      </div>

      {/* Engineering notice banner */}
      <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-surface-800 border border-surface-700">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-surface-400 leading-relaxed">
          <span className="font-semibold text-surface-300">Engineering Notice: </span>
          All pipe dimensions and fitting center-to-face values in this calculator are{' '}
          <span className="text-yellow-400 font-semibold">sample values</span> for demonstration.
          Verify all values against ASME B36.10M, ASME B16.9, and your project engineering standards
          before use in fabrication. This tool does not replace a licensed engineer.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr] gap-6">
        {/* ── LEFT PANEL: Pipe selector + Tab nav ── */}
        <div className="space-y-4">
          {/* Pipe selector summary card */}
          <div className="card p-4 space-y-1">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
              Selected Pipe
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-surface-50">
                {NPS_DISPLAY[nps]}
              </span>
              <span className="text-lg text-brand-400 font-semibold">
                {SCHEDULE_SHORT[schedule]}
              </span>
            </div>
            <p className="text-sm text-surface-400 capitalize">
              {material.replace('_', ' ')}
            </p>
          </div>

          {/* Tab navigation */}
          <nav className="space-y-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                    active
                      ? 'bg-brand-500/10 border border-brand-500/20 text-brand-300'
                      : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800 border border-transparent'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    active ? 'bg-brand-500/20' : 'bg-surface-700'
                  )}>
                    <Icon className={cn('w-4 h-4', active ? 'text-brand-400' : 'text-surface-400')} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium truncate', active && 'text-brand-300')}>
                      {tab.label}
                    </p>
                    <p className="text-xs text-surface-500 truncate">{tab.description}</p>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* Quick reference card */}
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Quick Reference
            </p>
            <div className="space-y-2 text-xs text-surface-400">
              <div className="flex justify-between">
                <span>1/8&quot; weld gap</span>
                <span className="font-mono text-surface-300">0.1250&quot;</span>
              </div>
              <div className="flex justify-between">
                <span>3/32&quot; weld gap</span>
                <span className="font-mono text-surface-300">0.0938&quot;</span>
              </div>
              <div className="border-t border-surface-700 pt-2 mt-2">
                <p className="text-surface-500 font-semibold mb-1">45° Multipliers</p>
                <div className="flex justify-between">
                  <span>Travel factor</span>
                  <span className="font-mono text-surface-300">× 1.4142</span>
                </div>
                <div className="flex justify-between">
                  <span>Set factor</span>
                  <span className="font-mono text-surface-300">× 1.0000</span>
                </div>
              </div>
              <div className="border-t border-surface-700 pt-2 mt-2">
                <p className="text-surface-500 font-semibold mb-1">22.5° Multipliers</p>
                <div className="flex justify-between">
                  <span>Travel factor</span>
                  <span className="font-mono text-surface-300">× 2.6131</span>
                </div>
                <div className="flex justify-between">
                  <span>Run factor</span>
                  <span className="font-mono text-surface-300">× 2.4142</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Active calculator content ── */}
        <div className="card">
          {/* Mobile tab bar (top of card) */}
          <div className="lg:hidden flex border-b border-surface-700 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-3 px-2 min-w-[80px] transition-colors text-xs font-medium',
                    active
                      ? 'text-brand-400 border-b-2 border-brand-500'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.shortLabel}
                </button>
              )
            })}
          </div>

          <div className="card-header hidden lg:flex items-center gap-3">
            {(() => {
              const tab = TABS.find(t => t.value === activeTab)!
              const Icon = tab.icon
              return (
                <>
                  <div className="w-8 h-8 bg-brand-500/15 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-brand-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-surface-100">{tab.label}</h2>
                    <p className="text-xs text-surface-500">{tab.description}</p>
                  </div>
                </>
              )
            })()}
          </div>

          <div className="card-body">
            {activeTab === 'pipe' && (
              <PipePropertiesPanel
                nps={nps}
                schedule={schedule}
                material={material}
                onNpsChange={setNps}
                onScheduleChange={setSchedule}
                onMaterialChange={setMaterial}
              />
            )}
            {activeTab === 'takeout' && (
              <TakeOutPanel nps={nps} />
            )}
            {activeTab === 'offset' && (
              <OffsetPanel />
            )}
            {activeTab === 'weight' && (
              <PipeWeightPanel nps={nps} schedule={schedule} />
            )}
            {activeTab === 'thermal' && (
              <ThermalExpansionPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Local display helpers ──────────────────────────────────
const NPS_DISPLAY: Record<NpsSize, string> = {
  '0.5':  '1/2"',
  '0.75': '3/4"',
  '1':    '1"',
  '1.25': '1-1/4"',
  '1.5':  '1-1/2"',
  '2':    '2"',
  '2.5':  '2-1/2"',
  '3':    '3"',
  '3.5':  '3-1/2"',
  '4':    '4"',
  '5':    '5"',
  '6':    '6"',
  '8':    '8"',
  '10':   '10"',
  '12':   '12"',
  '14':   '14"',
  '16':   '16"',
  '18':   '18"',
  '20':   '20"',
  '22':   '22"',
  '24':   '24"',
}

const SCHEDULE_SHORT: Record<PipeSchedule, string> = {
  sch_5:   'Sch 5',
  sch_10:  'Sch 10',
  sch_20:  'Sch 20',
  sch_40:  'Sch 40',
  sch_80:  'Sch 80',
  sch_120: 'Sch 120',
  sch_160: 'Sch 160',
  xxh:     'XXH',
  custom:  'Custom',
}

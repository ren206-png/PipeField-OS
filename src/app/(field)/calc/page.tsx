'use client'
// ============================================================
// Field Mode — Calculator Picker
// Grid of calculator cards. Tracks last-used in localStorage.
// ============================================================
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useFieldStrings } from '@/lib/field-mode/locale'

interface CalcCard {
  id: string
  label: string
  href: string
  isRigging?: boolean
}

const LAST_USED_KEY = 'field_calc_last_used'

export default function CalcPickerPage() {
  const t = useFieldStrings('en')
  const [lastUsed, setLastUsed] = useState<string | null>(null)

  useEffect(() => {
    try {
      setLastUsed(localStorage.getItem(LAST_USED_KEY))
    } catch { /* localStorage unavailable */ }
  }, [])

  const CALCS: CalcCard[] = [
    { id: 'simple-offset',    label: t.calc_simple_offset,    href: '/field/calc/simple-offset' },
    { id: 'rolling-offset',   label: t.calc_rolling_offset,   href: '/field/calc/rolling-offset' },
    { id: 'parallel-offsets', label: t.calc_parallel_offsets, href: '/field/calc/parallel-offsets' },
    { id: 'cut-bw',           label: t.calc_cut_bw,           href: '/field/calc/cut-bw' },
    { id: 'cut-sw',           label: t.calc_cut_sw,           href: '/field/calc/cut-sw' },
    { id: 'cut-threaded',     label: t.calc_cut_threaded,     href: '/field/calc/cut-threaded' },
    { id: 'odd-angle',        label: t.calc_odd_angle,        href: '/field/calc/odd-angle' },
    { id: 'two-hole-flange',  label: t.calc_two_hole_flange,  href: '/field/calc/two-hole-flange' },
    { id: 'branch-layout',    label: t.calc_branch_layout,    href: '/field/calc/branch-layout' },
    { id: 'miter',            label: t.calc_miter,            href: '/field/calc/miter' },
    { id: 'pipe-weight',      label: t.calc_pipe_weight,      href: '/field/calc/pipe-weight' },
    { id: 'rigging',          label: t.calc_rigging,          href: '/field/calc/rigging', isRigging: true },
    { id: 'stud-lookup',      label: t.calc_stud_lookup,      href: '/field/calc/stud-lookup' },
  ]

  function handleCardClick(id: string) {
    try { localStorage.setItem(LAST_USED_KEY, id) } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-surface-950 p-4">
      <h1 className="text-xl font-bold text-surface-100 mb-6">{t.calc_picker_title}</h1>
      <div className="grid grid-cols-2 gap-3">
        {CALCS.map((calc) => (
          <Link
            key={calc.id}
            href={calc.href}
            onClick={() => handleCardClick(calc.id)}
            className="block"
          >
            <div className={`
              relative rounded-2xl border p-4 min-h-[90px]
              flex flex-col justify-between
              bg-surface-900 border-surface-700
              active:bg-surface-800 transition-colors
              ${calc.isRigging ? 'border-red-800' : ''}
            `}>
              {lastUsed === calc.id && (
                <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-700 text-white font-medium">
                  Last used
                </span>
              )}
              {calc.isRigging && (
                <span className="absolute top-2 left-2 text-[10px] text-red-400">⚠</span>
              )}
              <span className="text-surface-100 text-sm font-semibold leading-snug mt-1">
                {calc.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

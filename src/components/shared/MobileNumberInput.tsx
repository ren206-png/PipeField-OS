'use client'
import { useState } from 'react'

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  unit?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number
  helper?: string
}

export function MobileNumberInput({ label, value, onChange, unit, placeholder, min, max, step = 0.001, helper }: Props) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-surface-200">{label}</label>
      {helper && <p className="text-xs text-surface-500">{helper}</p>}
      <div className={`flex items-center rounded-xl border bg-surface-800 transition-colors ${focused ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-surface-700'}`}>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="flex-1 bg-transparent px-4 py-4 text-lg font-medium text-surface-50 placeholder:text-surface-600 focus:outline-none min-h-[56px]"
        />
        {unit && (
          <span className="pr-4 text-sm font-medium text-surface-400 shrink-0">{unit}</span>
        )}
      </div>
    </div>
  )
}

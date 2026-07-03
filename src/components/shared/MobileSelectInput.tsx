'use client'
import { ChevronDown } from 'lucide-react'

interface Option { value: string; label: string }
interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  helper?: string
}

export function MobileSelectInput({ label, value, onChange, options, helper }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-surface-200">{label}</label>
      {helper && <p className="text-xs text-surface-500">{helper}</p>}
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-surface-700 bg-surface-800 px-4 py-4 pr-10 text-lg font-medium text-surface-50 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30 min-h-[56px]"
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-400" />
      </div>
    </div>
  )
}

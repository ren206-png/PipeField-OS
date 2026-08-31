'use client'
// ============================================================
// Field Mode — Fraction Keypad
// Glove-friendly keypad for feet-inches-fractions entry.
// Decimal is a MODE TOGGLE, not the default.
// Builds strings parseable by fromFeetInchesFraction() from types.ts.
// All buttons: min 56×56 px tap target.
// ============================================================
import React, { useState } from 'react'

export interface FractionKeypadProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
  unit: 'imperial' | 'metric'
}

// ── Key button ────────────────────────────────────────────────
interface KeyBtnProps {
  label: string
  onPress: () => void
  className?: string
  wide?: boolean
}

function KeyBtn({ label, onPress, className = '', wide = false }: KeyBtnProps) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onPress() }}
      className={`
        min-h-[56px] ${wide ? 'col-span-2' : ''}
        flex items-center justify-center
        rounded-xl text-base font-semibold select-none
        bg-surface-800 text-surface-100
        active:bg-surface-700
        border border-surface-700
        transition-colors duration-75
        ${className}
      `}
      aria-label={label}
    >
      {label}
    </button>
  )
}

// ── Fraction constants ────────────────────────────────────────
const FRACTIONS_16: { label: string; value: string }[] = [
  { label: '1/16',  value: '1/16'  },
  { label: '1/8',   value: '1/8'   },
  { label: '3/16',  value: '3/16'  },
  { label: '1/4',   value: '1/4'   },
  { label: '5/16',  value: '5/16'  },
  { label: '3/8',   value: '3/8'   },
  { label: '7/16',  value: '7/16'  },
  { label: '1/2',   value: '1/2'   },
  { label: '9/16',  value: '9/16'  },
  { label: '5/8',   value: '5/8'   },
  { label: '11/16', value: '11/16' },
  { label: '3/4',   value: '3/4'   },
  { label: '13/16', value: '13/16' },
  { label: '7/8',   value: '7/8'   },
  { label: '15/16', value: '15/16' },
]

export function FractionKeypad({ value, onChange, onSubmit, unit }: FractionKeypadProps) {
  const [decimalMode, setDecimalMode] = useState(false)

  function append(s: string) {
    onChange(value + s)
  }

  function backspace() {
    onChange(value.slice(0, -1))
  }

  function appendFraction(frac: string) {
    // If current value ends with a whole number (no fraction yet), add space separator
    const trimmed = value.trimEnd()
    if (trimmed.length > 0 && !/[\s/]$/.test(trimmed)) {
      onChange(trimmed + ' ' + frac)
    } else {
      onChange(trimmed + frac)
    }
  }

  function appendUnit(u: 'ft' | 'in' | 'mm') {
    const trimmed = value.trimEnd()
    if (u === 'ft')  onChange(trimmed + "'")
    else if (u === 'in') onChange(trimmed + '"')
    else onChange(trimmed + 'mm')
  }

  if (unit === 'metric') {
    // Metric mode: simple numeric keypad with decimal and mm suffix
    return (
      <div className="grid grid-cols-4 gap-2 p-2 bg-surface-900 rounded-2xl">
        {['7','8','9'].map(d => (
          <KeyBtn key={d} label={d} onPress={() => append(d)} />
        ))}
        <KeyBtn label="mm" onPress={() => appendUnit('mm')} className="text-amber-400" />
        {['4','5','6'].map(d => (
          <KeyBtn key={d} label={d} onPress={() => append(d)} />
        ))}
        <KeyBtn label="⌫" onPress={backspace} className="text-red-400" />
        {['1','2','3'].map(d => (
          <KeyBtn key={d} label={d} onPress={() => append(d)} />
        ))}
        <KeyBtn label="↵" onPress={() => onSubmit(value)} className="bg-blue-700 text-white border-blue-600" />
        <KeyBtn label="0" onPress={() => append('0')} />
        <KeyBtn label="." onPress={() => append('.')} />
        <div />
        <div />
      </div>
    )
  }

  // Imperial mode
  return (
    <div className="grid grid-cols-4 gap-2 p-2 bg-surface-900 rounded-2xl">
      {/* Row 1 */}
      <KeyBtn label="7" onPress={() => append('7')} />
      <KeyBtn label="8" onPress={() => append('8')} />
      <KeyBtn label="9" onPress={() => append('9')} />
      <KeyBtn label="ft" onPress={() => appendUnit('ft')} className="text-amber-400" />
      {/* Row 2 */}
      <KeyBtn label="4" onPress={() => append('4')} />
      <KeyBtn label="5" onPress={() => append('5')} />
      <KeyBtn label="6" onPress={() => append('6')} />
      <KeyBtn label="in" onPress={() => appendUnit('in')} className="text-amber-400" />
      {/* Row 3 */}
      <KeyBtn label="1" onPress={() => append('1')} />
      <KeyBtn label="2" onPress={() => append('2')} />
      <KeyBtn label="3" onPress={() => append('3')} />
      <KeyBtn label="mm" onPress={() => appendUnit('mm')} className="text-amber-400" />
      {/* Row 4 */}
      <KeyBtn label="0" onPress={() => append('0')} />
      <KeyBtn label="/" onPress={() => append('/')} />
      <KeyBtn label="⌫" onPress={backspace} className="text-red-400" />
      <KeyBtn label="↵" onPress={() => onSubmit(value)} className="bg-blue-700 text-white border-blue-600" />

      {/* Fraction rows or decimal mode toggle */}
      {decimalMode ? (
        <>
          <KeyBtn label="." onPress={() => append('.')} />
          <div className="col-span-2" />
          <KeyBtn
            label="FRAC"
            onPress={() => setDecimalMode(false)}
            className="text-amber-400 text-xs"
          />
        </>
      ) : (
        <>
          {FRACTIONS_16.map(f => (
            <KeyBtn
              key={f.value}
              label={f.label}
              onPress={() => appendFraction(f.value)}
              className="text-xs text-blue-300"
            />
          ))}
          <KeyBtn
            label="DEC"
            onPress={() => setDecimalMode(true)}
            className="text-amber-400 text-xs"
          />
        </>
      )}
    </div>
  )
}

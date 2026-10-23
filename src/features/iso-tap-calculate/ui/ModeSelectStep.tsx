'use client'
// ============================================================
// ISO Tap-to-Calculate — Step 2: Mode Selection
// ============================================================
import React from 'react'

export type CalcMode = 'mode-a' | 'mode-b'

interface ModeSelectStepProps {
  onSelect: (mode: CalcMode) => void
  onBack: () => void
}

const MODES: Array<{
  id: CalcMode
  title: string
  subtitle: string
  fields: string
  description: string
}> = [
  {
    id: 'mode-a',
    title: 'Known rise, roll and run',
    subtitle: 'Mode A',
    fields: 'V · H · U → Travel, Angle',
    description:
      'You know the perpendicular height difference (rise), the side-to-side difference (roll), and the centre-line distance between the two elbows (run). The calculator finds the pipe travel and the required elbow angle.',
  },
  {
    id: 'mode-b',
    title: 'Known rise, roll and elbow angle',
    subtitle: 'Mode B',
    fields: 'V · H · θ → Travel, Run',
    description:
      'You know the rise and roll of the offset and the elbow angle you will use (e.g. 45°). The calculator finds the pipe travel and the run between elbow centrelines.',
  },
]

export function ModeSelectStep({ onSelect, onBack }: ModeSelectStepProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-surface-400 text-sm">Choose the dimensions you have measured on the drawing.</p>

      {MODES.map(m => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m.id)}
          className="
            text-left min-h-[90px] rounded-2xl border p-4
            bg-surface-900 border-surface-700
            active:bg-surface-800 transition-colors
            flex flex-col gap-1
          "
        >
          <div className="flex items-center justify-between">
            <span className="text-surface-100 font-bold text-base">{m.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-800 text-brand-400 font-mono border border-surface-700">
              {m.subtitle}
            </span>
          </div>
          <span className="text-brand-400 font-mono text-xs">{m.fields}</span>
          <span className="text-surface-400 text-xs leading-snug">{m.description}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={onBack}
        className="min-h-[56px] rounded-xl bg-surface-800 text-surface-400 text-sm font-medium"
      >
        ← Back
      </button>
    </div>
  )
}

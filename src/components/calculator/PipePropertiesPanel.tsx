// ============================================================
// PipePropertiesPanel — Pipe OD / Wall / ID display
// Shows the pipe's physical dimensions based on NPS + Schedule
// ============================================================
'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  NPS_SIZES, PIPE_SCHEDULES, PIPE_MATERIALS,
  type NpsSize, type PipeSchedule, type PipeMaterial,
} from '@/config/pipe-data'
import { calculatePipeProperties } from '@/lib/calculator/pipe-calculations'
import { ResultCard } from './ResultCard'
import { WarningBanner } from './WarningBanner'

interface PipePropertiesPanelProps {
  nps: NpsSize
  schedule: PipeSchedule
  material: PipeMaterial
  onNpsChange:      (v: NpsSize) => void
  onScheduleChange: (v: PipeSchedule) => void
  onMaterialChange: (v: PipeMaterial) => void
}

export function PipePropertiesPanel({
  nps, schedule, material,
  onNpsChange, onScheduleChange, onMaterialChange,
}: PipePropertiesPanelProps) {
  const [customOD,   setCustomOD]   = useState('')
  const [customWall, setCustomWall] = useState('')

  const result = calculatePipeProperties(
    nps,
    schedule,
    schedule === 'custom' ? parseFloat(customOD) || undefined : undefined,
    schedule === 'custom' ? parseFloat(customWall) || undefined : undefined,
  )

  return (
    <div className="space-y-5">
      {/* Material */}
      <div>
        <label className="label">Pipe Material</label>
        <div className="relative">
          <select
            value={material}
            onChange={e => onMaterialChange(e.target.value as PipeMaterial)}
            className="input appearance-none pr-10 cursor-pointer"
          >
            {PIPE_MATERIALS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
        </div>
      </div>

      {/* NPS + Schedule row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">NPS Size</label>
          <div className="relative">
            <select
              value={nps}
              onChange={e => onNpsChange(e.target.value as NpsSize)}
              className="input appearance-none pr-8 cursor-pointer"
            >
              {NPS_SIZES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="label">Schedule</label>
          <div className="relative">
            <select
              value={schedule}
              onChange={e => onScheduleChange(e.target.value as PipeSchedule)}
              className="input appearance-none pr-8 cursor-pointer"
            >
              {PIPE_SCHEDULES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Custom schedule inputs */}
      {schedule === 'custom' && (
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-700/50 border border-surface-600">
          <div>
            <label className="label">OD (inches)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="e.g. 4.500"
              value={customOD}
              onChange={e => setCustomOD(e.target.value)}
              className="input font-mono"
            />
          </div>
          <div>
            <label className="label">Wall (inches)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              placeholder="e.g. 0.337"
              value={customWall}
              onChange={e => setCustomWall(e.target.value)}
              className="input font-mono"
            />
          </div>
        </div>
      )}

      {/* Results */}
      <div className="grid grid-cols-3 gap-3">
        <ResultCard
          label="OD"
          value={result.od > 0 ? `${result.od.toFixed(3)}"` : '—'}
          subValue="Outside Dia."
        />
        <ResultCard
          label="Wall"
          value={result.wall > 0 ? `${result.wall.toFixed(3)}"` : '—'}
          subValue="Thickness"
        />
        <ResultCard
          label="ID"
          value={result.id > 0 ? `${result.id.toFixed(3)}"` : '—'}
          subValue="Inside Dia."
        />
      </div>

      <WarningBanner warnings={result.warnings} />
    </div>
  )
}

// ============================================================
// ThermalExpansionPanel — Thermal Expansion Calculator
// ΔL = α × L × ΔT
// α  = coefficient of thermal expansion (in/in/°F)
// L  = pipe run length (inches or feet)
// ΔT = temperature change (°F or °C)
// ============================================================
'use client'

import { useState, useMemo } from 'react'
import { Thermometer, Info } from 'lucide-react'
import { ResultCard } from './ResultCard'

// Thermal expansion coefficients (in/in/°F × 10⁻⁶)
const ALPHA: Record<string, { value: number; label: string; note: string }> = {
  carbon_steel:  { value: 6.50e-6, label: 'Carbon Steel (A106/A53)',  note: 'ASME B31.3 Table C-1' },
  stainless_304: { value: 9.60e-6, label: 'Stainless 304/304L',       note: 'ASME B31.3 Table C-2' },
  stainless_316: { value: 8.90e-6, label: 'Stainless 316/316L',       note: 'ASME B31.3 Table C-2' },
  chrome_moly:   { value: 7.70e-6, label: 'Chrome-Moly P11/P22',      note: 'ASME B31.3 Table C-1' },
  duplex:        { value: 7.50e-6, label: 'Duplex 2205',               note: 'Typical manufacturer data' },
  hastelloy:     { value: 6.80e-6, label: 'Hastelloy C-276',           note: 'Typical manufacturer data' },
  inconel:       { value: 7.20e-6, label: 'Inconel 625',               note: 'Typical manufacturer data' },
  copper:        { value: 9.80e-6, label: 'Copper',                    note: 'ASME B31.1 Table C-1' },
  aluminum:      { value: 13.1e-6, label: 'Aluminum',                  note: 'Typical' },
  pvc:           { value: 30.0e-6, label: 'PVC',                       note: 'Typical' },
}

export function ThermalExpansionPanel() {
  const [material,      setMaterial]      = useState('carbon_steel')
  const [length,        setLength]        = useState('')
  const [lengthUnit,    setLengthUnit]    = useState<'ft' | 'in'>('ft')
  const [tempInstall,   setTempInstall]   = useState('')
  const [tempOperating, setTempOperating] = useState('')
  const [tempUnit,      setTempUnit]      = useState<'F' | 'C'>('F')

  const calc = useMemo(() => {
    const L_raw = parseFloat(length)
    const T1    = parseFloat(tempInstall)
    const T2    = parseFloat(tempOperating)

    if (!L_raw || isNaN(T1) || isNaN(T2)) return null

    // Convert to inches and °F for the formula
    const L_in = lengthUnit === 'ft' ? L_raw * 12 : L_raw
    const dT_F = tempUnit === 'C' ? (T2 - T1) * 9 / 5 : T2 - T1

    const alpha = ALPHA[material]?.value ?? 6.5e-6
    const deltaL_in = alpha * L_in * dT_F

    return {
      deltaL_in,
      deltaL_mm:  deltaL_in * 25.4,
      deltaL_ft:  deltaL_in / 12,
      dT_F,
      dT_C:       tempUnit === 'F' ? (T2 - T1) * 5 / 9 : T2 - T1,
      alpha,
      L_ft:       lengthUnit === 'ft' ? L_raw : L_raw / 12,
      expansion:  dT_F > 0,
    }
  }, [material, length, lengthUnit, tempInstall, tempOperating, tempUnit])

  const mat = ALPHA[material]

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-800 border border-surface-700">
        <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-surface-400 space-y-1">
          <p>
            <span className="font-semibold text-surface-300">Formula: </span>
            ΔL = α × L × ΔT
          </p>
          <p>Use to size expansion loops, offsets, or guides on long runs.</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        <div>
          <label className="label">Pipe Material</label>
          <select
            value={material}
            onChange={e => setMaterial(e.target.value)}
            className="input"
          >
            {Object.entries(ALPHA).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {mat && (
            <p className="text-xs text-surface-500 mt-1">
              α = {(mat.value * 1e6).toFixed(2)} × 10⁻⁶ in/in/°F — {mat.note}
            </p>
          )}
        </div>

        {/* Length input */}
        <div>
          <label className="label">Pipe Run Length</label>
          <div className="flex gap-2">
            <input
              type="number" step="0.01" min="0"
              value={length}
              onChange={e => setLength(e.target.value)}
              placeholder={`e.g. ${lengthUnit === 'ft' ? '100' : '1200'}`}
              className="input font-mono flex-1"
            />
            <div className="flex rounded-lg overflow-hidden border border-surface-600">
              {(['ft', 'in'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setLengthUnit(u)}
                  className={`px-3 py-2 text-xs font-mono font-semibold transition-colors ${
                    lengthUnit === u
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Temperature inputs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Temperatures</label>
            <div className="flex rounded-lg overflow-hidden border border-surface-600">
              {(['F', 'C'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setTempUnit(u)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    tempUnit === u
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-surface-500 mb-1">Installation Temp (°{tempUnit})</p>
              <input
                type="number" step="1"
                value={tempInstall}
                onChange={e => setTempInstall(e.target.value)}
                placeholder={tempUnit === 'F' ? '70' : '21'}
                className="input font-mono"
              />
            </div>
            <div>
              <p className="text-xs text-surface-500 mb-1">Operating Temp (°{tempUnit})</p>
              <input
                type="number" step="1"
                value={tempOperating}
                onChange={e => setTempOperating(e.target.value)}
                placeholder={tempUnit === 'F' ? '350' : '177'}
                className="input font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      {calc ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-surface-700 pb-2">
            <Thermometer className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-surface-200">
              Thermal {calc.expansion ? 'Expansion' : 'Contraction'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ResultCard
              label={`ΔL — ${calc.expansion ? 'Expansion' : 'Contraction'} (inches)`}
              value={`${Math.abs(calc.deltaL_in).toFixed(4)}"`}
              subValue={`${Math.abs(calc.deltaL_mm).toFixed(1)} mm`}
              highlight
            />
            <ResultCard
              label="ΔL in feet"
              value={`${Math.abs(calc.deltaL_ft).toFixed(4)} ft`}
              subValue={`ΔT = ${Math.abs(calc.dT_F).toFixed(1)}°F (${Math.abs(calc.dT_C).toFixed(1)}°C)`}
            />
          </div>

          {/* Engineering guidance */}
          <div className="bg-surface-800 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Engineering Guidance</p>
            <ul className="text-xs text-surface-400 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">▸</span>
                <span>
                  <span className="text-surface-300 font-semibold">Expansion loop size: </span>
                  Min loop length ≈ {(Math.sqrt(3 * 0.375 * Math.abs(calc.deltaL_in))).toFixed(1)}&quot;
                  (assumes 3&quot; NPS; verify with stress analysis)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">▸</span>
                <span>
                  <span className="text-surface-300 font-semibold">Guide spacing: </span>
                  Place first guide ≤ 4× loop leg from anchor; subsequent guides at 2× spacing.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">▸</span>
                <span>This calculator gives a linear approximation. For high-temp/high-pressure systems, use Caesar II or equivalent stress analysis software.</span>
              </li>
            </ul>
          </div>

          {/* Calculation summary */}
          <div className="bg-surface-900 rounded-lg p-3 font-mono text-xs text-surface-400 space-y-0.5">
            <p className="text-surface-500">// Calculation summary</p>
            <p>α  = {(calc.alpha * 1e6).toFixed(2)}e-6 in/in/°F</p>
            <p>L  = {(calc.L_ft * 12).toFixed(2)} in ({calc.L_ft.toFixed(2)} ft)</p>
            <p>ΔT = {calc.dT_F.toFixed(1)}°F</p>
            <p className="text-brand-400">ΔL = {calc.alpha.toFixed(8)} × {(calc.L_ft * 12).toFixed(2)} × {calc.dT_F.toFixed(1)} = {calc.deltaL_in.toFixed(4)}&quot;</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-surface-500 italic">
          Fill in all fields above to calculate thermal {tempInstall && tempOperating && parseFloat(tempOperating) > parseFloat(tempInstall) ? 'expansion' : 'movement'}.
        </p>
      )}
    </div>
  )
}

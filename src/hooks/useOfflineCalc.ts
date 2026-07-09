'use client'
// ============================================================
// useOfflineCalc — Pipe support span calculation with offline fallback
//
// Strategy:
//   1. Try the FastAPI backend (/api/pipe-support/calculate).
//   2. If offline / backend unreachable → run client-side TypeScript
//      calculation (runOfflineCalc) — works with zero connectivity.
//   3. Show a banner when the offline engine was used so engineers
//      know the result hasn't been server-validated.
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import type { CalcResult } from '@/components/pipe-support/SupportCalculator'
import { runOfflineCalc, type OfflineCalcInput } from '@/lib/offline/pipeCalc'
import { apiFetch } from '@/lib/apiFetch'

type NetworkStatus = 'online' | 'offline' | 'unknown'

export interface UseOfflineCalcReturn {
  calculate:     (formData: Record<string, unknown>) => Promise<CalcResult | null>
  loading:       boolean
  error:         string | null
  usedOffline:   boolean
  networkStatus: NetworkStatus
}

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/** Map the full API CalcResult shape from the lightweight offline shape */
function offlineToCalcResult(o: ReturnType<typeof runOfflineCalc>, input: OfflineCalcInput): CalcResult {
  return {
    dimensions: { OD_in: o.OD_in, wall_in: o.wall_in, ID_in: o.ID_in },
    areas: {
      metal_area_in2:      o.metal_area_in2,
      fluid_area_in2:      o.fluid_area_in2,
      insulation_area_in2: o.insulation_area_in2,
    },
    weights: {
      metal_lbft:      o.metal_lbft,
      fluid_lbft:      o.fluid_lbft,
      insulation_lbft: o.insulation_lbft,
      total_lbft:      o.total_lbft,
    },
    span: {
      calculated_ft:           o.calculated_ft,
      recommended_ft:          o.recommended_ft,
      company_ft:               o.company_ft,
      selected_ft:              o.selected_ft,
      moment_of_inertia_in4:   o.moment_of_inertia_in4,
      elastic_modulus_psi:     o.elastic_modulus_psi,
    },
    slope: {
      // Slope requires field measurement data not available client-side
      min_slope_in_per_ft: input.design_basis === 'B31.3' ? 0.125 : 0.0625,
    },
    hydrotest: {
      W_water_lbft:      o.W_water_lbft,
      W_test_lbft:       o.W_test_lbft,
      P_test_lb:         o.P_test_lb,
      operating_load_lb: o.operating_load_lb,
      percent_increase:  o.percent_increase,
    },
    weld_clearance: {
      pass:                true,
      conflicts:           [],
      adjusted_locations_ft: [],
      audit_entries:       ['⚠ Weld clearance check requires online mode'],
    },
  }
}

function buildOfflineInput(formData: Record<string, unknown>): OfflineCalcInput {
  return {
    nps:                       String(formData.nps      ?? '4.0'),
    schedule:                  String(formData.schedule ?? 'SCH40'),
    standard:                  (formData.standard as 'B36.10M' | 'B36.19M') ?? 'B36.10M',
    material:                  (formData.material as OfflineCalcInput['material']) ?? 'carbon_steel',
    fluid:                     (formData.fluid   as OfflineCalcInput['fluid'])    ?? 'water',
    fluid_density_lbft3:       formData.fluid_density_lbft3 as number | undefined,
    insulation_thickness_in:   (formData.insulation_thickness_in  as number) ?? 0,
    insulation_density_lbft3:  (formData.insulation_density_lbft3 as number) ?? 5,
    deflection_limit_in:       (formData.deflection_limit_in       as number) ?? 0.10,
    design_basis:              (formData.design_basis as 'B31.3' | 'B31.1') ?? 'B31.3',
    company_span_ft:           formData.company_span_ft as number | undefined,
  }
}

export function useOfflineCalc(): UseOfflineCalcReturn {
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [usedOffline,   setUsedOffline]   = useState(false)
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('unknown')

  useEffect(() => {
    setNetworkStatus(isOnline() ? 'online' : 'offline')
    const onOnline  = () => setNetworkStatus('online')
    const onOffline = () => setNetworkStatus('offline')
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const calculate = useCallback(async (formData: Record<string, unknown>): Promise<CalcResult | null> => {
    setLoading(true)
    setError(null)
    setUsedOffline(false)

    // ── Attempt server-side calculation ────────────────────
    if (isOnline()) {
      try {
        const res = await apiFetch('/api/pipe-support/calculate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(formData),
          signal:  AbortSignal.timeout(8000),   // 8 s timeout
        })
        if (res.ok) {
          const data = await res.json()
          setLoading(false)
          return data.output_json ?? data
        }
        // Non-OK response → fall through to offline
        const err = await res.json().catch(() => ({ detail: 'Server error' }))
        throw new Error(err.detail ?? 'Calculation failed')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        // Network-level error (timeout, no connection) → try offline
        const isNetworkError = ['Failed to fetch', 'AbortError', 'TimeoutError', 'NetworkError']
          .some(s => msg.includes(s))
        if (!isNetworkError) {
          setError(msg)
          setLoading(false)
          return null
        }
        // Fall through to offline engine
      }
    }

    // ── Offline engine ─────────────────────────────────────
    try {
      const offlineInput = buildOfflineInput(formData)
      const raw = runOfflineCalc(offlineInput)
      const result = offlineToCalcResult(raw, offlineInput)
      setUsedOffline(true)
      setLoading(false)
      return result
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Offline calculation failed')
      setLoading(false)
      return null
    }
  }, [])

  return { calculate, loading, error, usedOffline, networkStatus }
}

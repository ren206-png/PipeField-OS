// ============================================================
// Field Mode Calc — Cut Length Calculators
// Pure TypeScript. No framework/DB imports.
// ============================================================

import {
  type Length,
  type CalcResult,
  type RefRow,
  fromMm,
  toMm,
  ok,
  err,
  makeMissingRef,
  makeInvalidInput,
} from './types'
import type { ReferenceAdapter } from './reference'

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type CutLengthResult = {
  cut_length: Length
  take_outs: Array<{
    end: 'A' | 'B'
    fitting_type: string
    take_out: Length
    assumed: boolean
  }>
}

// ---------------------------------------------------------------------------
// Butt-Weld Cut Length
// ---------------------------------------------------------------------------

export type BwFittingSpec = {
  end: 'A' | 'B'
  type: string
  nps: string
  standard?: string
  edition?: string
  flange_class?: number
  run_nps?: string
  outlet_nps?: string
}

export type CutLengthBwInput = {
  center_to_center: Length
  fittings: BwFittingSpec[]
  assume_lr_standard: boolean
}

export async function cutLengthButtWeld(
  input: CutLengthBwInput,
  ref: ReferenceAdapter,
): Promise<CalcResult<CutLengthResult>> {
  const allRefs: RefRow<unknown>[] = []
  const warnings: string[] = []
  const takeOuts: CutLengthResult['take_outs'] = []

  for (const fitting of input.fittings) {
    let takeOutMm: number | null = null
    let assumed = false

    if (fitting.type === 'reducing_tee') {
      const runNps = fitting.run_nps ?? fitting.nps
      const outletNps = fitting.outlet_nps
      if (!outletNps) {
        return err(makeInvalidInput('outlet_nps', 'required for reducing_tee'))
      }
      const rows = await ref.getReducingTeeOutlet({
        run_nps: runNps,
        outlet_nps: outletNps,
        standard: fitting.standard,
        edition: fitting.edition,
      })
      allRefs.push(...(rows as RefRow<unknown>[]))
      if (rows.length > 0) {
        takeOutMm = rows[0].data.outlet_center_to_end_m_mm
      }
    } else if (fitting.type === 'flange_wn') {
      const flangeClass = fitting.flange_class
      if (flangeClass == null) {
        return err(makeInvalidInput('flange_class', 'required for flange_wn'))
      }
      const rows = await ref.getFlange({
        nps: fitting.nps,
        flange_class: flangeClass,
        standard: fitting.standard,
        edition: fitting.edition,
      })
      allRefs.push(...(rows as RefRow<unknown>[]))
      if (rows.length > 0) {
        takeOutMm = rows[0].data.lth_wn_mm
      }
    } else {
      // elbow_90_lr, elbow_45_lr, elbow_90_sr, tee, cap, reducer, etc.
      const rows = await ref.getBwFitting({
        nps: fitting.nps,
        fitting_type: fitting.type,
        standard: fitting.standard,
        edition: fitting.edition,
      })
      allRefs.push(...(rows as RefRow<unknown>[]))
      if (rows.length > 0) {
        takeOutMm = rows[0].data.center_to_end_mm
      }
    }

    if (takeOutMm == null) {
      // Not found
      if (!input.assume_lr_standard) {
        return err(
          makeMissingRef('ref_bw_fittings', {
            nps: fitting.nps,
            fitting_type: fitting.type,
            standard: fitting.standard,
            edition: fitting.edition,
          }),
        )
      }
      // Fallback: try to get OD from any BW fitting for this NPS
      const anyRows = await ref.getBwFitting({ nps: fitting.nps, fitting_type: 'elbow_90_lr' })
      allRefs.push(...(anyRows as RefRow<unknown>[]))
      if (anyRows.length === 0) {
        return err(
          makeMissingRef('ref_bw_fittings', {
            nps: fitting.nps,
            fitting_type: 'any (for OD lookup)',
          }),
        )
      }
      const odMm = anyRows[0].data.od_mm
      takeOutMm = 1.5 * odMm
      assumed = true
      warnings.push(
        `Fitting ${fitting.type} NPS ${fitting.nps} not found; assumed LR standard take-out = 1.5 × OD = ${takeOutMm.toFixed(3)} mm`,
      )
    }

    takeOuts.push({
      end: fitting.end,
      fitting_type: fitting.type,
      take_out: fromMm(takeOutMm),
      assumed,
    })
  }

  const ctcMm = toMm(input.center_to_center)
  const totalTakeOut = takeOuts.reduce((sum, t) => sum + toMm(t.take_out), 0)
  const cutLengthMm = ctcMm - totalTakeOut

  return ok({ cut_length: fromMm(cutLengthMm), take_outs: takeOuts }, allRefs, warnings)
}

// ---------------------------------------------------------------------------
// Socket-Weld Cut Length
// ---------------------------------------------------------------------------

export type SwFittingSpec = {
  end: 'A' | 'B'
  type: 'coupling' | '90_elbow' | '45_elbow' | string
  nps: string
  fitting_class?: number
  standard?: string
}

export type CutLengthSwInput = {
  center_to_center: Length
  fittings: SwFittingSpec[]
  /** Gap between pipe end and socket bottom. Default 1.5875 mm (1/16 in) */
  gap_mm?: number
}

export async function cutLengthSocketWeld(
  input: CutLengthSwInput,
  ref: ReferenceAdapter,
): Promise<CalcResult<CutLengthResult>> {
  const gapMm = input.gap_mm ?? 1.5875 // 1/16 inch
  const allRefs: RefRow<unknown>[] = []
  const takeOuts: CutLengthResult['take_outs'] = []
  const warnings: string[] = ['assumes minimum socket depth (J_min)']

  for (const fitting of input.fittings) {
    let takeOutMm: number | null = null

    if (fitting.type === 'coupling') {
      const rows = await ref.getSwCoupling({ nps: fitting.nps, fitting_class: fitting.fitting_class })
      allRefs.push(...(rows as RefRow<unknown>[]))
      if (rows.length === 0) {
        return err(makeMissingRef('ref_sw_couplings', { nps: fitting.nps }))
      }
      const row = rows[0].data
      // A = socket bottom dimension (use J_min as proxy for coupling socket depth)
      // For coupling: deduction = socket_depth_j_min (half coupling per end)
      const jMinIn = row.socket_depth_j_min_in ?? 0
      const jMinMm = jMinIn * 25.4
      takeOutMm = jMinMm - gapMm
    } else {
      const rows = await ref.getSwFitting({
        nps: fitting.nps,
        fitting_class: fitting.fitting_class,
        standard: fitting.standard,
      })
      allRefs.push(...(rows as RefRow<unknown>[]))
      if (rows.length === 0) {
        return err(makeMissingRef('ref_sw_fittings', { nps: fitting.nps, fitting_type: fitting.type }))
      }
      const row = rows[0].data
      if (fitting.type === '45_elbow') {
        const a45mm = row.ctr_to_socket_bottom_45_mm
        const jMinMm = row.socket_depth_j_min_mm ?? 0
        if (a45mm == null) {
          return err(makeMissingRef('ref_sw_fittings', { nps: fitting.nps, dim: 'ctr_to_socket_bottom_45_mm' }))
        }
        takeOutMm = a45mm - jMinMm + gapMm
      } else {
        // 90_elbow, tee, etc.
        const a90mm = row.ctr_to_socket_bottom_a_90_tee_mm
        const jMinMm = row.socket_depth_j_min_mm ?? 0
        if (a90mm == null) {
          return err(makeMissingRef('ref_sw_fittings', { nps: fitting.nps, dim: 'ctr_to_socket_bottom_a_90_tee_mm' }))
        }
        takeOutMm = a90mm - jMinMm + gapMm
      }
    }

    takeOuts.push({
      end: fitting.end,
      fitting_type: fitting.type,
      take_out: fromMm(takeOutMm),
      assumed: false,
    })
  }

  const ctcMm = toMm(input.center_to_center)
  const totalTakeOut = takeOuts.reduce((sum, t) => sum + toMm(t.take_out), 0)
  const cutLengthMm = ctcMm - totalTakeOut

  return ok({ cut_length: fromMm(cutLengthMm), take_outs: takeOuts }, allRefs, warnings)
}

// ---------------------------------------------------------------------------
// Threaded Cut Length
// ---------------------------------------------------------------------------

export type ThreadedFittingSpec = {
  end: 'A' | 'B'
  type: '90_elbow' | '45_elbow' | string
  nps: string
}

export type CutLengthThreadedInput = {
  center_to_center: Length
  fittings: ThreadedFittingSpec[]
}

export async function cutLengthThreaded(
  input: CutLengthThreadedInput,
  ref: ReferenceAdapter,
): Promise<CalcResult<CutLengthResult>> {
  const allRefs: RefRow<unknown>[] = []
  const takeOuts: CutLengthResult['take_outs'] = []

  for (const fitting of input.fittings) {
    const fRows = await ref.getThreadedFitting({ nps: fitting.nps, fitting_type: fitting.type })
    allRefs.push(...(fRows as RefRow<unknown>[]))
    if (fRows.length === 0) {
      return err(makeMissingRef('ref_threaded_fittings', { nps: fitting.nps, fitting_type: fitting.type }))
    }

    const tRows = await ref.getNptThread({ nps: fitting.nps })
    allRefs.push(...(tRows as RefRow<unknown>[]))
    if (tRows.length === 0) {
      return err(makeMissingRef('ref_npt_threads', { nps: fitting.nps }))
    }

    const fRow = fRows[0].data
    const tRow = tRows[0].data

    let ctrToEndMm: number | null = null
    if (fitting.type === '45_elbow') {
      ctrToEndMm = fRow.ctr_to_end_45_mm
    } else {
      ctrToEndMm = fRow.ctr_to_end_a_90_tee_mm
    }

    if (ctrToEndMm == null) {
      return err(makeMissingRef('ref_threaded_fittings', { nps: fitting.nps, dim: 'center_to_end_mm' }))
    }

    const makeupIn = tRow.total_makeup_l1_plus_l3_in
    if (makeupIn == null) {
      return err(makeMissingRef('ref_npt_threads', { nps: fitting.nps, dim: 'total_makeup_l1_plus_l3_in' }))
    }
    const makeupMm = makeupIn * 25.4

    const takeOutMm = ctrToEndMm - makeupMm

    takeOuts.push({
      end: fitting.end,
      fitting_type: fitting.type,
      take_out: fromMm(takeOutMm),
      assumed: false,
    })
  }

  const ctcMm = toMm(input.center_to_center)
  const totalTakeOut = takeOuts.reduce((sum, t) => sum + toMm(t.take_out), 0)
  const cutLengthMm = ctcMm - totalTakeOut

  return ok({ cut_length: fromMm(cutLengthMm), take_outs: takeOuts }, allRefs)
}

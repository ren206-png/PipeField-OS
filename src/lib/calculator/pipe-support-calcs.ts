// ============================================================
// Pipe Support Pure Calculation Functions
// Source references:
//   MSS SP-58 / MSS SP-69 — support type selection & span tables
//   ASME B31.3 Process Piping — allowable stress, hydrotest
//   ASME B31.1 Power Piping  — alt design basis
// All functions are pure (no side effects) and unit-tested.
// ============================================================

// ── Types ─────────────────────────────────────────────────────

export interface SpanResult {
  calculated_ft: number
  recommended_ft: number
  selected_ft: number
  moment_of_inertia_in4: number
  elastic_modulus_psi: number
}

export interface HangerLoadResult {
  point_load_lb: number
  distributed_load_lbft: number
  span_ft: number
}

export interface HydrotestResult {
  W_water_lbft: number
  W_test_lbft: number
  P_test_lb: number
  operating_load_lb: number
  percent_increase: number
}

export interface ClevisResult {
  rod_diameter_in: number
  rod_area_in2: number
  rod_stress_psi: number
  rod_capacity_lb: number
  pass: boolean
}

export interface TrapezeResult {
  beam_span_ft: number
  moment_lb_in: number
  required_section_modulus_in3: number
  recommended_size: string
}

export interface ShoeResult {
  shoe_height_in: number
  bearing_area_in2: number
  bearing_stress_psi: number
  pass: boolean
}

export interface SagResult {
  midspan_deflection_in: number
  required_shim_in: number
  shim_fraction_str: string
  corrected_elevation_in: number
}

export interface WeldClearanceResult {
  pass: boolean
  conflicts: Array<{
    original_ft: number
    weld_ft: number
    gap_in: number
    shifted_by_in: number
    adjusted_to_ft: number
  }>
  adjusted_locations_ft: number[]
  audit_entries: string[]
}

export interface InterferenceResult {
  clearance_in: number
  insulation_od_in: number
  structural_face_in: number
  pass: boolean
  recommendation: string
}

// ── Material constants ─────────────────────────────────────────

const ELASTIC_MODULUS: Record<string, number> = {
  carbon_steel:     29_000_000,
  stainless_steel:  28_000_000,
  copper:           17_000_000,
  pvc:               400_000,
  hdpe:              110_000,
}

/** MSS SP-69 recommended max span (ft) for water-filled pipe, by NPS */
const MSS_SP69_WATER_SPAN: Record<string, number> = {
  '0.5': 7, '0.75': 7, '1.0': 7, '1.25': 7, '1.5': 9,
  '2.0': 10, '2.5': 11, '3.0': 12, '3.5': 13, '4.0': 14,
  '5.0': 16, '6.0': 17, '8.0': 19, '10.0': 22, '12.0': 23,
  '14.0': 25, '16.0': 27, '18.0': 28, '20.0': 30, '24.0': 32,
  '30.0': 35, '36.0': 39, '42.0': 42, '48.0': 45, '60.0': 50,
}

// ── 1. Support Span Calculation ────────────────────────────────
// Beam deflection formula (simply-supported): δ = 5wL⁴ / (384EI)
// Solved for L: L = (384·E·I·δ_allow / (5·w))^(1/4)
// Source: AISC Steel Construction Manual beam tables; MSS SP-69 Table 3

export function calcSupportSpan(params: {
  OD_in: number
  wall_in: number
  total_lbft: number
  material: string
  nps: string
  span_company_ft?: number
  deflection_allow_in?: number
}): SpanResult {
  const { OD_in, wall_in, total_lbft, material, nps, span_company_ft, deflection_allow_in = 0.1 } = params
  const E = ELASTIC_MODULUS[material] ?? ELASTIC_MODULUS.carbon_steel

  // Moment of inertia for hollow circular cross-section: I = π(OD⁴ - ID⁴) / 64
  const ID_in = OD_in - 2 * wall_in
  const I = (Math.PI / 64) * (Math.pow(OD_in, 4) - Math.pow(ID_in, 4))

  // w in lb/in (convert from lb/ft)
  const w = total_lbft / 12

  // Solve for L in inches: δ = 5wL⁴/(384EI) → L = (384·E·I·δ / (5·w))^0.25
  const L_in = Math.pow((384 * E * I * deflection_allow_in) / (5 * w), 0.25)
  const calculated_ft = L_in / 12

  // Recommended = min(calculated, MSS SP-69 table value)
  const mss = MSS_SP69_WATER_SPAN[nps] ?? 10
  const recommended_ft = Math.min(calculated_ft, mss)

  // Selected = min(recommended, company standard if given)
  const selected_ft = span_company_ft
    ? Math.min(recommended_ft, span_company_ft)
    : recommended_ft

  return {
    calculated_ft: Math.round(calculated_ft * 100) / 100,
    recommended_ft: Math.round(recommended_ft * 10) / 10,
    selected_ft: Math.round(selected_ft * 10) / 10,
    moment_of_inertia_in4: Math.round(I * 10000) / 10000,
    elastic_modulus_psi: E,
  }
}

// ── 2. Hanger Point Load ──────────────────────────────────────
// Point load at each support = w × span
// Source: MSS SP-58 §5.2

export function calcHangerLoad(params: {
  total_lbft: number
  span_ft: number
}): HangerLoadResult {
  const { total_lbft, span_ft } = params
  const point_load_lb = total_lbft * span_ft
  return {
    point_load_lb: Math.round(point_load_lb * 10) / 10,
    distributed_load_lbft: Math.round(total_lbft * 10) / 10,
    span_ft,
  }
}

// ── 3. Hydrotest Load ─────────────────────────────────────────
// W_water = fluid_area × 62.4 / 144 (lb/ft)
// P_test  = W_test × span  (point load on support at test)
// Source: ASME B31.3 §345.4 — hydrotest at 1.5× design pressure (weight calc only here)

export function calcHydrotest(params: {
  fluid_area_in2: number
  metal_lbft: number
  insulation_lbft: number
  span_ft: number
}): HydrotestResult {
  const { fluid_area_in2, metal_lbft, insulation_lbft, span_ft } = params
  const W_water_lbft = (fluid_area_in2 * 62.4) / 144
  const W_test_lbft = metal_lbft + W_water_lbft + insulation_lbft
  const operating_load_lb = W_test_lbft * span_ft   // approx (same formula, different fluid)
  const P_test_lb = W_test_lbft * span_ft
  const percent_increase = ((P_test_lb - operating_load_lb) / operating_load_lb) * 100

  return {
    W_water_lbft: Math.round(W_water_lbft * 100) / 100,
    W_test_lbft: Math.round(W_test_lbft * 100) / 100,
    P_test_lb: Math.round(P_test_lb * 10) / 10,
    operating_load_lb: Math.round(operating_load_lb * 10) / 10,
    percent_increase: Math.round(percent_increase * 10) / 10,
  }
}

// ── 4. Clevis Hanger Rod Sizing ───────────────────────────────
// Threaded rod allowable load per ASME B18.2.1 / MSS SP-58 Table 1
// Allowable tensile stress = 12,000 psi (A36 threaded rod, common field default)
// Source: MSS SP-58 Table 1; Piping Engineering (Tube Turns)

const CLEVIS_ROD_SIZES = [
  { dia: 0.375, area: 0.0775 }, { dia: 0.5,   area: 0.1419 },
  { dia: 0.625, area: 0.2260 }, { dia: 0.75,  area: 0.3340 },
  { dia: 0.875, area: 0.4620 }, { dia: 1.0,   area: 0.6060 },
  { dia: 1.125, area: 0.7630 }, { dia: 1.25,  area: 0.9690 },
  { dia: 1.5,   area: 1.4050 }, { dia: 1.75,  area: 1.9000 },
  { dia: 2.0,   area: 2.5000 },
]
const CLEVIS_ALLOWABLE_PSI = 12_000

export function calcClevis(params: { load_lb: number }): ClevisResult {
  const { load_lb } = params
  const required_area = load_lb / CLEVIS_ALLOWABLE_PSI

  const rod = CLEVIS_ROD_SIZES.find(r => r.area >= required_area) ?? CLEVIS_ROD_SIZES[CLEVIS_ROD_SIZES.length - 1]
  const rod_stress_psi = load_lb / rod.area
  const rod_capacity_lb = rod.area * CLEVIS_ALLOWABLE_PSI

  return {
    rod_diameter_in: rod.dia,
    rod_area_in2: rod.area,
    rod_stress_psi: Math.round(rod_stress_psi),
    rod_capacity_lb: Math.round(rod_capacity_lb),
    pass: rod_stress_psi <= CLEVIS_ALLOWABLE_PSI,
  }
}

// ── 5. Trapeze Frame Sizing ───────────────────────────────────
// Simple beam: M = wL²/8 for uniform load, or PL/4 for mid-point
// Required S = M / Fb, Fb = 0.66Fy (A36 = 36 ksi → Fb = 23.76 ksi)
// Source: AISC ASD 9th Ed.; MSS SP-58 §6

const TRAPEZE_FB_PSI = 23_760  // Allowable bending stress, A36
const TRAPEZE_SECTIONS = [
  { name: 'C3×4.1',  S: 1.10 }, { name: 'C4×5.4',  S: 1.93 },
  { name: 'C5×6.7',  S: 3.00 }, { name: 'C6×8.2',  S: 4.38 },
  { name: 'C8×11.5', S: 8.14 }, { name: 'C10×15.3', S: 13.8 },
]

export function calcTrapeze(params: {
  load_lb: number
  beam_span_ft: number
}): TrapezeResult {
  const { load_lb, beam_span_ft } = params
  const M_lb_in = (load_lb * beam_span_ft * 12) / 4  // concentrated mid-point
  const required_S = M_lb_in / TRAPEZE_FB_PSI

  const section = TRAPEZE_SECTIONS.find(s => s.S >= required_S) ?? TRAPEZE_SECTIONS[TRAPEZE_SECTIONS.length - 1]

  return {
    beam_span_ft,
    moment_lb_in: Math.round(M_lb_in),
    required_section_modulus_in3: Math.round(required_S * 1000) / 1000,
    recommended_size: section.name,
  }
}

// ── 6. Pipe Shoe Bearing Check ────────────────────────────────
// Bearing stress σ = P / A_bearing; A36 base plate → allowable 14,400 psi
// Standard shoe heights per MSS SP-58 Table 5
// Source: MSS SP-58 §7.2; AISC J8 (bearing on concrete: 0.35f'c, ignored here — steel-on-steel)

const SHOE_HEIGHTS_IN = [3, 4, 6, 8, 10, 12]
const SHOE_ALLOWABLE_BEARING_PSI = 14_400

export function calcShoe(params: {
  OD_in: number
  insulation_thickness_in: number
  load_lb: number
}): ShoeResult {
  const { OD_in, insulation_thickness_in, load_lb } = params
  // Shoe height = insulation thickness + 1" clearance (rounded up to std size)
  const min_height = insulation_thickness_in + 1
  const shoe_height_in = SHOE_HEIGHTS_IN.find(h => h >= min_height) ?? 12

  // Bearing area = OD × shoe_height (simplified rectangular projection)
  const bearing_area_in2 = OD_in * shoe_height_in
  const bearing_stress_psi = load_lb / bearing_area_in2

  return {
    shoe_height_in,
    bearing_area_in2: Math.round(bearing_area_in2 * 100) / 100,
    bearing_stress_psi: Math.round(bearing_stress_psi),
    pass: bearing_stress_psi <= SHOE_ALLOWABLE_BEARING_PSI,
  }
}

// ── 7. Sag / Shim Correction ──────────────────────────────────
// Midspan deflection: δ = 5wL⁴ / (384EI)
// Required shim = existing_sag + δ − existing_support_elevation
// Source: Field practice; ASME B31.3 §319.4 (flexibility analysis note)

export function calcSagCorrection(params: {
  OD_in: number
  wall_in: number
  total_lbft: number
  material: string
  span_ft: number
  existing_sag_in: number
  existing_support_elevation_in: number
}): SagResult {
  const { OD_in, wall_in, total_lbft, material, span_ft, existing_sag_in, existing_support_elevation_in } = params
  const E = ELASTIC_MODULUS[material] ?? ELASTIC_MODULUS.carbon_steel
  const ID_in = OD_in - 2 * wall_in
  const I = (Math.PI / 64) * (Math.pow(OD_in, 4) - Math.pow(ID_in, 4))
  const w = total_lbft / 12
  const L_in = span_ft * 12
  const deflection_in = (5 * w * Math.pow(L_in, 4)) / (384 * E * I)

  const required_shim = existing_sag_in + deflection_in - existing_support_elevation_in
  const clamped = Math.max(0, required_shim)

  // Convert to nearest 1/16"
  const sixteenths = Math.ceil(clamped * 16)
  const whole = Math.floor(sixteenths / 16)
  const rem = sixteenths % 16
  const fraction = rem > 0 ? ` ${rem}/16"` : ''
  const shim_fraction_str = whole > 0 ? `${whole}${fraction}` : rem > 0 ? `${rem}/16"` : '0"'

  return {
    midspan_deflection_in: Math.round(deflection_in * 10000) / 10000,
    required_shim_in: Math.round(clamped * 10000) / 10000,
    shim_fraction_str,
    corrected_elevation_in: Math.round((existing_support_elevation_in + clamped) * 1000) / 1000,
  }
}

// ── 8. Weld Clearance Check ───────────────────────────────────
// Ensures support locations don't fall within `clearance_in` of a weld.
// Conflicts are shifted downstream by (clearance_in / 12) ft.
// Source: ASME B31.3 §328.4 — welded joint proximity to supports; typical shop practice

export function calcWeldClearance(params: {
  support_locations_ft: number[]
  weld_locations_ft: number[]
  clearance_in: number
}): WeldClearanceResult {
  const { support_locations_ft, weld_locations_ft, clearance_in } = params
  const clearance_ft = clearance_in / 12
  const conflicts: WeldClearanceResult['conflicts'] = []
  const adjusted: number[] = []
  const audit: string[] = []

  for (const sup of support_locations_ft) {
    let adjusted_sup = sup
    let conflict_found = false

    for (const weld of weld_locations_ft) {
      const gap_in = Math.abs(sup - weld) * 12
      if (gap_in < clearance_in) {
        const new_loc = weld + clearance_ft  // shift downstream
        conflicts.push({
          original_ft: Math.round(sup * 1000) / 1000,
          weld_ft: Math.round(weld * 1000) / 1000,
          gap_in: Math.round(gap_in * 1000) / 1000,
          shifted_by_in: clearance_in,
          adjusted_to_ft: Math.round(new_loc * 1000) / 1000,
        })
        audit.push(`Support @${sup.toFixed(2)}ft conflicts with weld @${weld.toFixed(2)}ft (gap ${gap_in.toFixed(2)}"< ${clearance_in}") → shifted to ${new_loc.toFixed(2)}ft`)
        adjusted_sup = new_loc
        conflict_found = true
        break
      }
    }

    if (!conflict_found) audit.push(`Support @${sup.toFixed(2)}ft — CLEAR`)
    adjusted.push(Math.round(adjusted_sup * 1000) / 1000)
  }

  return {
    pass: conflicts.length === 0,
    conflicts,
    adjusted_locations_ft: adjusted,
    audit_entries: audit,
  }
}

// ── 9. Access / Interference Check ───────────────────────────
// Checks clearance between insulated pipe OD and structural member face.
// Min clearance for maintenance: 6" (general industrial practice)
// Source: ASME B31.3 §321.1.3; facility design guidelines

export function calcInterference(params: {
  OD_in: number
  insulation_thickness_in: number
  structural_face_in: number        // distance from pipe CL to nearest structural face
  min_clearance_in?: number
}): InterferenceResult {
  const { OD_in, insulation_thickness_in, structural_face_in, min_clearance_in = 6 } = params
  const insulation_od_in = OD_in + 2 * insulation_thickness_in
  const half_ins_od = insulation_od_in / 2
  const clearance_in = structural_face_in - half_ins_od
  const pass = clearance_in >= min_clearance_in

  const recommendation = pass
    ? `Clearance OK (${clearance_in.toFixed(2)}" > ${min_clearance_in}" min)`
    : `INSUFFICIENT CLEARANCE: ${clearance_in.toFixed(2)}" — min ${min_clearance_in}" required. Relocate structural member or reduce insulation thickness.`

  return {
    clearance_in: Math.round(clearance_in * 100) / 100,
    insulation_od_in: Math.round(insulation_od_in * 1000) / 1000,
    structural_face_in,
    pass,
    recommendation,
  }
}

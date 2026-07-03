// ============================================================
// pipeCalc.ts — Client-side pipe support span calculator
// Mirrors the Python logic in pipefield_os/calculations/pipe_support.py
// so calculations run offline without any backend.
//
// All formulae are from:
//  - ASME B31.3 / B31.1  (simply-supported beam deflection)
//  - MSS SP-69            (standard support span tables)
//  - Pipe dimensions from asme_pipe_dimensions.json (static import)
// ============================================================

import ASME_DATA from '@/data/asme_pipe_dimensions.json'

// ── Type declarations ──────────────────────────────────────

export type Standard = 'B36.10M' | 'B36.19M'
export type Material = 'carbon_steel' | 'stainless_steel' | 'copper'
export type Fluid    = 'water' | 'steam' | 'condensate' | 'air' | 'nitrogen' | 'natural_gas' | 'crude_oil' | 'custom'

export interface OfflineCalcInput {
  nps:        string          // e.g. "4.0"
  schedule:   string          // e.g. "SCH40"
  standard:   Standard
  material:   Material
  fluid:      Fluid
  fluid_density_lbft3?:   number  // for custom fluid
  insulation_thickness_in: number
  insulation_density_lbft3: number
  deflection_limit_in:     number // typically 0.10
  design_basis:            'B31.3' | 'B31.1'
  company_span_ft?:        number
}

export interface OfflineCalcResult {
  // Dimensions
  OD_in:    number
  wall_in:  number
  ID_in:    number
  // Areas
  metal_area_in2:       number
  fluid_area_in2:       number
  insulation_area_in2:  number
  // Weights (lb/ft)
  metal_lbft:       number
  fluid_lbft:       number
  insulation_lbft:  number
  total_lbft:       number
  // Span
  moment_of_inertia_in4: number
  elastic_modulus_psi:   number
  calculated_ft:    number
  recommended_ft:   number
  selected_ft:      number
  company_ft?:      number
  // Hydrotest (water fill)
  W_water_lbft:      number
  W_test_lbft:       number
  operating_load_lb: number
  P_test_lb:         number
  percent_increase:  number
}

// ── Constants ──────────────────────────────────────────────

const DENSITY_LB_FT3: Record<Material, number> = {
  carbon_steel:    490,
  stainless_steel: 494,
  copper:          556,
}

const ELASTIC_MODULUS_PSI: Record<Material, number> = {
  carbon_steel:    29_000_000,
  stainless_steel: 28_000_000,
  copper:          17_000_000,
}

const FLUID_DENSITY: Record<Fluid, number> = {
  water:       62.4,
  steam:       0.037,
  condensate:  62.0,
  air:         0.075,
  nitrogen:    0.072,
  natural_gas: 0.044,
  crude_oil:   54.0,
  custom:      62.4,
}

const WATER_DENSITY = 62.4   // lb/ft³

// ── Dimension lookup ───────────────────────────────────────

type AsmeData = {
  [standard: string]: {
    [nps: string]: {
      OD_in: number
      schedules: { [schedule: string]: { wall_in: number; ID_in: number } }
    }
  }
}

const DATA = ASME_DATA as AsmeData

export function getPipeDimensions(nps: string, schedule: string, standard: Standard) {
  const npsEntry = DATA[standard]?.[nps]
  if (!npsEntry) throw new Error(`NPS ${nps} not found in ${standard}`)
  const sched = npsEntry.schedules[schedule]
  if (!sched) throw new Error(`Schedule ${schedule} not found for NPS ${nps} ${standard}`)
  return { OD_in: npsEntry.OD_in, wall_in: sched.wall_in, ID_in: sched.ID_in }
}

// ── Area calculations ──────────────────────────────────────

function metalArea(OD: number, ID: number): number {
  return Math.PI / 4 * (OD ** 2 - ID ** 2)
}

function fluidArea(ID: number): number {
  return Math.PI / 4 * (ID ** 2)
}

function insulationArea(OD: number, t_ins: number): number {
  if (t_ins <= 0) return 0
  const OD_ins = OD + 2 * t_ins
  return Math.PI / 4 * (OD_ins ** 2 - OD ** 2)
}

// ── Weight calculations ────────────────────────────────────

function metalWeight(metalArea_in2: number, density_lbft3: number): number {
  // Convert in² to ft²: /144; then ×density ×1 ft length
  return (metalArea_in2 / 144) * density_lbft3
}

function fluidWeight(fluidArea_in2: number, density_lbft3: number): number {
  return (fluidArea_in2 / 144) * density_lbft3
}

function insulationWeight(insulationArea_in2: number, density_lbft3: number): number {
  return (insulationArea_in2 / 144) * density_lbft3
}

// ── Moment of inertia ──────────────────────────────────────

function momentOfInertia(OD: number, ID: number): number {
  return Math.PI / 64 * (OD ** 4 - ID ** 4)
}

// ── Support span (simply-supported beam deflection) ────────
// δ = 5wL⁴/(384EI)  →  L = (δ·384·E·I / (5·w))^(1/4)
// All in imperial: w in lb/in, L in inches, δ in inches

function calcSupportSpan(
  w_lbft: number,
  E_psi: number,
  I_in4: number,
  deflection_limit_in: number
): number {
  if (w_lbft <= 0) return 999
  const w_lbin = w_lbft / 12          // lb/in
  const L_in4 = (deflection_limit_in * 384 * E_psi * I_in4) / (5 * w_lbin)
  const L_in  = Math.pow(L_in4, 0.25)
  const L_ft  = L_in / 12
  return Math.round(L_ft * 10) / 10   // round to 1 decimal
}

function recommendedSpan(calculated_ft: number): number {
  const std = [5, 7, 10, 12, 14, 17, 19, 22, 25, 30]
  for (const s of std) {
    if (calculated_ft <= s) return s
  }
  return Math.floor(calculated_ft / 5) * 5
}

// ── Main orchestrator ──────────────────────────────────────

export function runOfflineCalc(input: OfflineCalcInput): OfflineCalcResult {
  const { OD_in, wall_in, ID_in } = getPipeDimensions(input.nps, input.schedule, input.standard)

  // Areas
  const metal_area_in2      = metalArea(OD_in, ID_in)
  const fluid_area_in2      = fluidArea(ID_in)
  const insulation_area_in2 = insulationArea(OD_in, input.insulation_thickness_in)

  // Densities
  const mat_density  = DENSITY_LB_FT3[input.material]
  const E            = ELASTIC_MODULUS_PSI[input.material]
  const f_density    = input.fluid === 'custom' && input.fluid_density_lbft3
    ? input.fluid_density_lbft3
    : FLUID_DENSITY[input.fluid]

  // Weights
  const metal_lbft      = metalWeight(metal_area_in2, mat_density)
  const fluid_lbft      = fluidWeight(fluid_area_in2, f_density)
  const insulation_lbft = insulationWeight(insulation_area_in2, input.insulation_density_lbft3)
  const total_lbft      = metal_lbft + fluid_lbft + insulation_lbft

  // Span
  const I             = momentOfInertia(OD_in, ID_in)
  const calculated_ft = calcSupportSpan(total_lbft, E, I, input.deflection_limit_in)
  const recommended_ft = recommendedSpan(calculated_ft)
  const company_ft    = input.company_span_ft
  const selected_ft   = company_ft
    ? Math.min(recommended_ft, company_ft)
    : recommended_ft

  // Hydrotest
  const W_water_lbft      = fluidWeight(fluid_area_in2, WATER_DENSITY)
  const W_test_lbft       = metal_lbft + W_water_lbft + insulation_lbft
  const operating_load_lb = total_lbft * selected_ft
  const P_test_lb         = W_test_lbft * selected_ft
  const percent_increase  = operating_load_lb > 0
    ? Math.round((P_test_lb - operating_load_lb) / operating_load_lb * 1000) / 10
    : 0

  return {
    OD_in, wall_in, ID_in,
    metal_area_in2, fluid_area_in2, insulation_area_in2,
    metal_lbft, fluid_lbft, insulation_lbft, total_lbft,
    moment_of_inertia_in4: I,
    elastic_modulus_psi:   E,
    calculated_ft, recommended_ft, selected_ft,
    ...(company_ft !== undefined ? { company_ft } : {}),
    W_water_lbft, W_test_lbft, operating_load_lb, P_test_lb, percent_increase,
  }
}

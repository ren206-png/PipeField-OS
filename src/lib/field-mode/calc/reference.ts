// ============================================================
// Field Mode Calc — Reference Adapter Interface
// Pure TypeScript. Zero framework/DB imports.
// Column names mirror the migration exactly.
// ============================================================

import type { RefRow } from './types'

// ---------------------------------------------------------------------------
// Row types — column names from migration
// ---------------------------------------------------------------------------

export interface BwFittingRow {
  nps: string
  od_in: number
  od_mm: number
  fitting_type: string
  dimension_label: string | null
  center_to_end_in: number
  center_to_end_mm: number
  derived: boolean | null
  standard: string | null
  edition: string | null
}

export interface FlangeRow {
  nps: string
  flange_class: number
  od_in: number
  od_mm: number
  thickness_in: number
  bolt_circle_in: number
  bolt_circle_mm: number
  bolt_count: number
  bolt_size_in: string
  bolt_hole_in: number
  rf_dia_in: number
  lth_wn_in: number
  lth_wn_mm: number
  standard: string | null
  edition: string | null
}

export interface ReducingTeeOutletRow {
  run_nps: string
  outlet_nps: string
  run_center_to_end_c_in: number
  run_center_to_end_c_mm: number
  outlet_center_to_end_m_in: number
  outlet_center_to_end_m_mm: number
  standard: string | null
  edition: string | null
}

export interface SwFittingRow {
  nps: string
  fitting_class: number | null
  pipe_od_in: number | null
  socket_bore_min_in: number | null
  socket_bore_max_in: number | null
  socket_bore_min_mm: number | null
  socket_bore_max_mm: number | null
  socket_depth_j_min_in: number | null
  socket_depth_j_min_mm: number | null
  socket_wall_c_min_in: number | null
  socket_wall_c_min_mm: number | null
  fitting_bore_d_in: number | null
  fitting_bore_d_mm: number | null
  ctr_to_socket_bottom_a_90_tee_in: number | null
  ctr_to_socket_bottom_a_90_tee_mm: number | null
  ctr_to_socket_bottom_45_in: number | null
  ctr_to_socket_bottom_45_mm: number | null
  standard: string | null
}

export interface SwCouplingRow {
  nps: string
  full_coupling_length_w_in: number | null
  full_coupling_length_w_mm: number | null
  socket_depth_j_min_in: number | null
  center_wall_min_in: number | null
  half_coupling_length_approx_in: number | null
  standard: string | null
  edition: string | null
}

export interface ThreadedFittingRow {
  nps: string
  ctr_to_end_a_90_tee_in: number | null
  ctr_to_end_a_90_tee_mm: number | null
  ctr_to_end_45_in: number | null
  ctr_to_end_45_mm: number | null
  thread_engagement_see: string | null
  standard: string | null
  edition: string | null
}

export interface NptThreadRow {
  nps: string
  tpi: number | null
  pitch_in: number | null
  pitch_mm: number | null
  pipe_od_in: number | null
  pipe_od_mm: number | null
  handtight_l1_in: number | null
  handtight_l1_mm: number | null
  handtight_turns: number | null
  effective_thread_l2_in: number | null
  effective_thread_l2_mm: number | null
  wrench_makeup_l3_in: number | null
  wrench_makeup_turns: number | null
  /** total_makeup_l1_plus_l3_in — exact column name from migration */
  total_makeup_l1_plus_l3_in: number | null
  taper: string | null
  standard: string | null
  edition: string | null
}

export interface StudBoltRow {
  nps: string
  flange_class: number
  stud_dia_in: string | null
  stud_dia_mm: number | null
  stud_length_in: string | null
  stud_length_dec_in: number | null
  stud_length_mm: number | null
  studs_per_flange: number | null
  nut_wrench_size_heavy_hex_in: number | null
  nut_wrench_size_mm: number | null
  nut_height_heavy_hex_in: number | null
  tpi: number | null
  thread_series: string | null
  check_min_plausible_length_in: number | null
  standard: string | null
  edition: string | null
}

export interface WrenchSizeRow {
  item: string
  size: string
  heavy_hex_across_flats_in: string | null
  heavy_hex_across_flats_mm: number | null
  regular_hex_across_flats_in: number | null
  heavy_hex_nut_height_in: number | null
  standard: string | null
  edition: string | null
}

export interface ShackleRow {
  bow_size_in: string
  bow_dia_in: number | null
  bow_dia_mm: number | null
  wll_short_tons: number | null
  wll_kg: number | null
  inside_width_at_pin_in: number | null
  inside_width_at_pin_mm: number | null
  pin_dia_in: number | null
  pin_dia_mm: number | null
  inside_length_in: number | null
  inside_length_mm: number | null
  standard: string | null
  edition: string | null
}

export interface SlingLegFactorRow {
  angle_from_horizontal_deg: number
  angle_from_vertical_deg: number | null
  leg_load_multiplier: number
  note: string | null
  standard: string | null
  edition: string | null
}

export interface SnatchBlockFactorRow {
  /** angle_between_lines_deg — exact column from migration */
  angle_between_lines_deg: number
  block_load_multiplier: number
  standard: string | null
  edition: string | null
}

export interface WireRopeSlingRow {
  rope_dia_in: string
  rope_dia_mm: number | null
  swl_vertical_short_tons: number | null
  swl_choker_short_tons: number | null
  swl_basket_vertical_short_tons: number | null
  nominal_breaking_strength_short_tons: number | null
  rule_of_thumb_swl_tons_8xd2: number | null
  standard: string | null
  edition: string | null
}

export interface SyntheticSlingRow {
  sling_type: string | null
  size_or_color: string | null
  wll_vertical_lb: number | null
  wll_choker_lb: number | null
  wll_basket_vertical_lb: number | null
  wll_vertical_kg: number | null
  standard: string | null
  edition: string | null
}

export interface ChainSlingRow {
  chain_grade: string | null
  chain_size_in: string
  chain_size_mm: number | null
  wll_single_vertical_lb: number | null
  wll_single_vertical_kg: number | null
  standard: string | null
  edition: string | null
}

export interface MaterialWeightRow {
  material: string
  density_lb_per_ft3: number | null
  density_kg_per_m3: number | null
  specific_gravity: number | null
  standard: string | null
  edition: string | null
}

export interface PlateSteelWeightRow {
  /** thickness_in is TEXT in migration */
  thickness_in: string
  thickness_mm: number | null
  weight_lb_per_ft2: number | null
  weight_kg_per_m2: number | null
  weight_lb_per_4x8_sheet: number | null
  standard: string | null
  edition: string | null
}

// ---------------------------------------------------------------------------
// ReferenceAdapter interface
// ---------------------------------------------------------------------------

export interface ReferenceAdapter {
  getBwFitting(p: {
    nps: string
    fitting_type: string
    standard?: string
    edition?: string
  }): Promise<RefRow<BwFittingRow>[]>

  getFlange(p: {
    nps: string
    flange_class: number
    standard?: string
    edition?: string
  }): Promise<RefRow<FlangeRow>[]>

  getReducingTeeOutlet(p: {
    run_nps: string
    outlet_nps: string
    standard?: string
    edition?: string
  }): Promise<RefRow<ReducingTeeOutletRow>[]>

  getSwFitting(p: {
    nps: string
    fitting_class?: number
    standard?: string
  }): Promise<RefRow<SwFittingRow>[]>

  getSwCoupling(p: {
    nps: string
    fitting_class?: number
  }): Promise<RefRow<SwCouplingRow>[]>

  getThreadedFitting(p: {
    nps: string
    fitting_type: string
  }): Promise<RefRow<ThreadedFittingRow>[]>

  getNptThread(p: {
    nps: string
  }): Promise<RefRow<NptThreadRow>[]>

  getStudBolt(p: {
    nps: string
    flange_class: number
    standard?: string
  }): Promise<RefRow<StudBoltRow>[]>

  getWrenchSize(p: {
    item: string
    size: string
  }): Promise<RefRow<WrenchSizeRow>[]>

  getShackle(p: {
    bow_size_in?: string
    min_wll_kg?: number
  }): Promise<RefRow<ShackleRow>[]>

  getSlingLegFactor(p: {
    angle_from_horizontal_deg: number
    standard?: string
  }): Promise<RefRow<SlingLegFactorRow>[]>

  getSnatchBlockFactor(p: {
    deflection_angle_deg: number
  }): Promise<RefRow<SnatchBlockFactorRow>[]>

  getWireRopeSling(p: {
    diameter_in?: string
    min_swl_kg?: number
    rope_grade?: string
  }): Promise<RefRow<WireRopeSlingRow>[]>

  getSyntheticSling(p: {
    width_in?: string
    min_wll_kg?: number
  }): Promise<RefRow<SyntheticSlingRow>[]>

  getChainSling(p: {
    chain_size?: string
    min_wll_kg?: number
    safety_factor?: number
  }): Promise<RefRow<ChainSlingRow>[]>

  getMaterialWeight(p: {
    material: string
  }): Promise<RefRow<MaterialWeightRow>[]>

  getPlateSteelWeight(p: {
    thickness_in?: number
    material?: string
  }): Promise<RefRow<PlateSteelWeightRow>[]>
}

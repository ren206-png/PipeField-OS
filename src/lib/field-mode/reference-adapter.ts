// ============================================================
// Field Mode Reference DB Adapter
// Implements ReferenceAdapter (Phase 2) against Supabase.
// Uses ANON client only — NO createAdminClient.
//
// Rejected rows (rejected=true in migration) are excluded from
// all queries via .neq('rejected', true). This prevents rejected
// reference data from feeding calculators.
//
// NOTE: ref tables use RLS "ref_*_read_all" policy:
//   FOR SELECT TO authenticated USING (true)
// Any authenticated user can read. Anon key + user session is sufficient.
// ============================================================
'use client'
import { createClient } from '@/lib/supabase/client'
import type {
  ReferenceAdapter,
  BwFittingRow,
  FlangeRow,
  ReducingTeeOutletRow,
  SwFittingRow,
  SwCouplingRow,
  ThreadedFittingRow,
  NptThreadRow,
  StudBoltRow,
  WrenchSizeRow,
  ShackleRow,
  SlingLegFactorRow,
  SnatchBlockFactorRow,
  WireRopeSlingRow,
  SyntheticSlingRow,
  ChainSlingRow,
  MaterialWeightRow,
  PlateSteelWeightRow,
} from '@/lib/field-mode/calc/reference'
import type { RefRow } from '@/lib/field-mode/calc/types'

function toRefRow<T>(row: Record<string, unknown>): RefRow<T> {
  return {
    data: row as T,
    row_id: (row.id as string) ?? '',
    verified: (row.verified as boolean) ?? false,
    recall_confidence: (row.recall_confidence as RefRow<T>['recall_confidence']) ?? 'unrated',
    source_doc: (row.source_doc as string) ?? '',
    standard: (row.standard as string | null) ?? null,
    edition: (row.edition as string | null) ?? null,
  }
}

// isBadRow: exclude rows where rejected=true.
// The migration confirms all ref tables have: rejected BOOLEAN NOT NULL DEFAULT false
function isBadRow(row: Record<string, unknown>): boolean {
  return row.rejected === true
}

export function createSupabaseReferenceAdapter(): ReferenceAdapter {
  const supabase = createClient()

  return {
    async getBwFitting({ nps, fitting_type, standard, edition }) {
      let q = supabase.from('ref_bw_fittings').select('*')
        .eq('nps', nps)
        .eq('fitting_type', fitting_type)
        .neq('rejected', true)
      if (standard) q = q.eq('standard', standard)
      if (edition)  q = q.eq('edition', edition)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<BwFittingRow>(r))
    },

    async getFlange({ nps, flange_class, standard, edition }) {
      let q = supabase.from('ref_flanges').select('*')
        .eq('nps', nps)
        .eq('flange_class', flange_class)
        .neq('rejected', true)
      if (standard) q = q.eq('standard', standard)
      if (edition)  q = q.eq('edition', edition)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<FlangeRow>(r))
    },

    async getReducingTeeOutlet({ run_nps, outlet_nps, standard, edition }) {
      let q = supabase.from('ref_reducing_tee_outlets').select('*')
        .eq('run_nps', run_nps)
        .eq('outlet_nps', outlet_nps)
        .neq('rejected', true)
      if (standard) q = q.eq('standard', standard)
      if (edition)  q = q.eq('edition', edition)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<ReducingTeeOutletRow>(r))
    },

    async getSwFitting({ nps, fitting_class, standard }) {
      let q = supabase.from('ref_sw_fittings').select('*')
        .eq('nps', nps)
        .neq('rejected', true)
      if (fitting_class !== undefined) q = q.eq('fitting_class', fitting_class)
      if (standard) q = q.eq('standard', standard)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<SwFittingRow>(r))
    },

    async getSwCoupling({ nps, fitting_class }) {
      let q = supabase.from('ref_sw_couplings').select('*')
        .eq('nps', nps)
        .neq('rejected', true)
      if (fitting_class !== undefined) q = q.eq('fitting_class', fitting_class)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<SwCouplingRow>(r))
    },

    async getThreadedFitting({ nps, fitting_type }) {
      const { data } = await supabase.from('ref_threaded_fittings').select('*')
        .eq('nps', nps)
        .eq('fitting_type', fitting_type)
        .neq('rejected', true)
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<ThreadedFittingRow>(r))
    },

    async getNptThread({ nps }) {
      const { data } = await supabase.from('ref_npt_threads').select('*')
        .eq('nps', nps)
        .neq('rejected', true)
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<NptThreadRow>(r))
    },

    async getStudBolt({ nps, flange_class, standard }) {
      let q = supabase.from('ref_stud_bolts').select('*')
        .eq('nps', nps)
        .eq('flange_class', flange_class)
        .neq('rejected', true)
      if (standard) q = q.eq('standard', standard)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<StudBoltRow>(r))
    },

    async getWrenchSize({ item, size }) {
      const { data } = await supabase.from('ref_wrench_sizes').select('*')
        .eq('item', item)
        .eq('size', size)
        .neq('rejected', true)
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<WrenchSizeRow>(r))
    },

    async getShackle({ bow_size_in, min_wll_kg }) {
      let q = supabase.from('ref_shackles').select('*')
        .neq('rejected', true)
      if (bow_size_in) q = q.eq('bow_size_in', bow_size_in)
      if (min_wll_kg !== undefined) q = q.gte('wll_kg', min_wll_kg)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<ShackleRow>(r))
    },

    async getSlingLegFactor({ angle_from_horizontal_deg, standard }) {
      let q = supabase.from('ref_sling_leg_factors').select('*')
        .eq('angle_from_horizontal_deg', angle_from_horizontal_deg)
        .neq('rejected', true)
      if (standard) q = q.eq('standard', standard)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<SlingLegFactorRow>(r))
    },

    async getSnatchBlockFactor({ deflection_angle_deg }) {
      // The table column is angle_between_lines_deg (exact from migration)
      const { data } = await supabase.from('ref_snatch_block_factors').select('*')
        .eq('angle_between_lines_deg', deflection_angle_deg)
        .neq('rejected', true)
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<SnatchBlockFactorRow>(r))
    },

    async getWireRopeSling({ diameter_in, min_swl_kg }) {
      let q = supabase.from('ref_wire_rope_slings').select('*')
        .neq('rejected', true)
      if (diameter_in) q = q.eq('rope_dia_in', diameter_in)
      if (min_swl_kg !== undefined) q = q.gte('swl_vertical_short_tons', min_swl_kg / 907.185)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<WireRopeSlingRow>(r))
    },

    async getSyntheticSling({ width_in, min_wll_kg }) {
      let q = supabase.from('ref_synthetic_slings').select('*')
        .neq('rejected', true)
      if (width_in) q = q.eq('size_or_color', width_in)
      if (min_wll_kg !== undefined) q = q.gte('wll_vertical_kg', min_wll_kg)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<SyntheticSlingRow>(r))
    },

    async getChainSling({ chain_size, min_wll_kg }) {
      let q = supabase.from('ref_chain_slings').select('*')
        .neq('rejected', true)
      if (chain_size) q = q.eq('chain_size_in', chain_size)
      if (min_wll_kg !== undefined) q = q.gte('wll_single_vertical_kg', min_wll_kg)
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<ChainSlingRow>(r))
    },

    async getMaterialWeight({ material }) {
      const { data } = await supabase.from('ref_material_weights').select('*')
        .eq('material', material)
        .neq('rejected', true)
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<MaterialWeightRow>(r))
    },

    async getPlateSteelWeight({ thickness_in }) {
      let q = supabase.from('ref_plate_steel_weights').select('*')
        .neq('rejected', true)
      if (thickness_in !== undefined) q = q.eq('thickness_in', String(thickness_in))
      const { data } = await q
      return (data ?? []).filter(r => !isBadRow(r)).map(r => toRefRow<PlateSteelWeightRow>(r))
    },
  }
}

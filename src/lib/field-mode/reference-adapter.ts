// ============================================================
// Field Mode Reference DB Adapter
// Calls /api/field/ref (server-side, service role) instead of
// querying Supabase directly from the browser.
// This avoids RLS session issues on mobile / PWA.
// ============================================================
'use client'
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

/** Fetch from the server-side reference proxy (bypasses RLS, uses service role). */
async function fetchRef<T>(
  table: string,
  filters: Record<string, string | number | undefined>,
): Promise<RefRow<T>[]> {
  const params = new URLSearchParams({ table })
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null) params.set(k, String(v))
  }
  const res = await fetch(`/api/field/ref?${params.toString()}`)
  if (!res.ok) {
    console.error('[ref-adapter] fetch failed', res.status, await res.text())
    return []
  }
  const data: Record<string, unknown>[] = await res.json()
  return data.map(r => toRefRow<T>(r))
}

export function createSupabaseReferenceAdapter(): ReferenceAdapter {
  return {
    async getBwFitting({ nps, fitting_type, standard, edition }) {
      return fetchRef<BwFittingRow>('ref_bw_fittings', { nps, fitting_type, standard, edition })
    },

    async getFlange({ nps, flange_class, standard, edition }) {
      return fetchRef<FlangeRow>('ref_flanges', { nps, flange_class, standard, edition })
    },

    async getReducingTeeOutlet({ run_nps, outlet_nps, standard, edition }) {
      return fetchRef<ReducingTeeOutletRow>('ref_reducing_tee_outlets', { run_nps, outlet_nps, standard, edition })
    },

    async getSwFitting({ nps, fitting_class, standard }) {
      return fetchRef<SwFittingRow>('ref_sw_fittings', { nps, fitting_class, standard })
    },

    async getSwCoupling({ nps, fitting_class }) {
      return fetchRef<SwCouplingRow>('ref_sw_couplings', { nps, fitting_class })
    },

    async getThreadedFitting({ nps }) {
      return fetchRef<ThreadedFittingRow>('ref_threaded_fittings', { nps })
    },

    async getNptThread({ nps }) {
      return fetchRef<NptThreadRow>('ref_npt_threads', { nps })
    },

    async getStudBolt({ nps, flange_class, standard }) {
      return fetchRef<StudBoltRow>('ref_stud_bolts', { nps, flange_class, standard })
    },

    async getWrenchSize({ item, size }) {
      return fetchRef<WrenchSizeRow>('ref_wrench_sizes', { item, size })
    },

    async getShackle({ bow_size_in, min_wll_kg }) {
      // For shackle we need >= wll_kg filter — handled partially; full filter on client
      const rows = await fetchRef<ShackleRow>('ref_shackles', { bow_size_in })
      if (min_wll_kg !== undefined) {
        return rows.filter(r => ((r.data as Record<string,unknown>).wll_kg as number) >= min_wll_kg)
      }
      return rows
    },

    async getSlingLegFactor({ angle_from_horizontal_deg, standard }) {
      return fetchRef<SlingLegFactorRow>('ref_sling_leg_factors', { angle_from_horizontal_deg, standard })
    },

    async getSnatchBlockFactor({ deflection_angle_deg }) {
      return fetchRef<SnatchBlockFactorRow>('ref_snatch_block_factors', { angle_between_lines_deg: deflection_angle_deg })
    },

    async getWireRopeSling({ diameter_in, min_swl_kg }) {
      const rows = await fetchRef<WireRopeSlingRow>('ref_wire_rope_slings', { rope_dia_in: diameter_in })
      if (min_swl_kg !== undefined) {
        return rows.filter(r => ((r.data as Record<string,unknown>).swl_vertical_short_tons as number) >= min_swl_kg / 907.185)
      }
      return rows
    },

    async getSyntheticSling({ width_in, min_wll_kg }) {
      const rows = await fetchRef<SyntheticSlingRow>('ref_synthetic_slings', { size_or_color: width_in })
      if (min_wll_kg !== undefined) {
        return rows.filter(r => ((r.data as Record<string,unknown>).wll_vertical_kg as number) >= min_wll_kg)
      }
      return rows
    },

    async getChainSling({ chain_size, min_wll_kg }) {
      const rows = await fetchRef<ChainSlingRow>('ref_chain_slings', { chain_size_in: chain_size })
      if (min_wll_kg !== undefined) {
        return rows.filter(r => ((r.data as Record<string,unknown>).wll_single_vertical_kg as number) >= min_wll_kg)
      }
      return rows
    },

    async getMaterialWeight({ material }) {
      return fetchRef<MaterialWeightRow>('ref_material_weights', { material })
    },

    async getPlateSteelWeight({ thickness_in }) {
      return fetchRef<PlateSteelWeightRow>('ref_plate_steel_weights', { thickness_in })
    },
  }
}

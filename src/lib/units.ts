// ============================================================
// units.ts — Unit conversion utilities
// All internal storage is imperial (inches, feet, psi, lb, °F).
// These helpers convert to SI for display when project.unit_system === 'si'.
// ============================================================

export type UnitSystem = 'imperial' | 'si' | 'mixed'

// ── Constants ─────────────────────────────────────────────────
export const IN_TO_MM     = 25.4
export const FT_TO_M      = 0.3048
export const LB_TO_KG     = 0.453592
export const LBFT_TO_KGM  = LB_TO_KG / FT_TO_M   // 1.48816
export const PSI_TO_BAR   = 0.0689476
export const PSI_TO_KPA   = 6.89476
export const PSI_TO_MPA   = 0.00689476

// ── Length ────────────────────────────────────────────────────
export function inToMm(inches: number):   number { return +(inches * IN_TO_MM).toFixed(3) }
export function mmToIn(mm: number):       number { return +(mm / IN_TO_MM).toFixed(4) }
export function ftToM(ft: number):        number { return +(ft * FT_TO_M).toFixed(3) }
export function mToFt(m: number):         number { return +(m / FT_TO_M).toFixed(3) }

// ── Mass / linear density ─────────────────────────────────────
export function lbToKg(lb: number):       number { return +(lb * LB_TO_KG).toFixed(3) }
export function lbftToKgm(lbft: number):  number { return +(lbft * LBFT_TO_KGM).toFixed(3) }

// ── Pressure ─────────────────────────────────────────────────
export function psiToBar(psi: number):    number { return +(psi * PSI_TO_BAR).toFixed(3) }
export function psiToKpa(psi: number):    number { return +(psi * PSI_TO_KPA).toFixed(2) }
export function psiToMpa(psi: number):    number { return +(psi * PSI_TO_MPA).toFixed(4) }
export function barToPsi(bar: number):    number { return +(bar / PSI_TO_BAR).toFixed(2) }

// ── Temperature ───────────────────────────────────────────────
export function fToC(f: number):          number { return +((f - 32) * 5 / 9).toFixed(2) }
export function cToF(c: number):          number { return +(c * 9 / 5 + 32).toFixed(2) }

// ── NPS → DN mapping ─────────────────────────────────────────
// Per ASME B36.10M Table 1 / ISO 6708
export const NPS_TO_DN: Record<string, number> = {
  '0.5': 15,  '0.75': 20, '1': 25,   '1.25': 32,  '1.5': 40,
  '2':   50,  '2.5':  65, '3': 80,   '3.5':  90,  '4':   100,
  '5':   125, '6':    150, '8': 200,  '10':   250,  '12':  300,
  '14':  350, '16':   400, '18': 450, '20':   500,  '22':  550,
  '24':  600, '26':   650, '28': 700, '30':   750,  '32':  800,
  '34':  850, '36':   900, '38': 950, '40':   1000, '42':  1050,
  '44':  1100,'46':   1150,'48': 1200,'60':   1500,
}

export function npsToDn(nps: string | number): number | null {
  return NPS_TO_DN[String(nps)] ?? null
}

// ── Dimension object converters ───────────────────────────────
export interface DimensionImperial {
  OD_in:   number
  wall_in: number
  ID_in:   number
}

export interface DimensionSI {
  OD_mm:   number
  wall_mm: number
  ID_mm:   number
  DN_mm:   number | null
}

export function dimToSI(d: DimensionImperial, nps?: string): DimensionSI {
  return {
    OD_mm:   inToMm(d.OD_in),
    wall_mm: inToMm(d.wall_in),
    ID_mm:   inToMm(d.ID_in),
    DN_mm:   nps ? (npsToDn(nps) ?? null) : null,
  }
}

// ── Formatting helpers (plain strings, no i18n dependency) ────
export function formatLength(val_in: number, sys: UnitSystem): string {
  if (sys === 'si') return `${inToMm(val_in)} mm`
  return `${val_in.toFixed(3)}"`
}

export function formatSpan(val_ft: number, sys: UnitSystem): string {
  if (sys === 'si') return `${ftToM(val_ft).toFixed(2)} m`
  return `${val_ft.toFixed(2)} ft`
}

export function formatPressure(val_psi: number, sys: UnitSystem): string {
  if (sys === 'si') return `${psiToKpa(val_psi).toFixed(0)} kPa`
  return `${val_psi.toFixed(0)} psi`
}

export function formatTemp(val_f: number, sys: UnitSystem): string {
  if (sys === 'si') return `${fToC(val_f).toFixed(1)} °C`
  return `${val_f.toFixed(1)} °F`
}

export function formatWeight(val_lbft: number, sys: UnitSystem): string {
  if (sys === 'si') return `${lbftToKgm(val_lbft).toFixed(2)} kg/m`
  return `${val_lbft.toFixed(2)} lb/ft`
}

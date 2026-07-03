// ============================================================
// PipeField OS — Pipe Dimension Data Tables
//
// IMPORTANT: Values marked [SAMPLE] are representative values
// for development and demonstration purposes only.
// Before production use, verify ALL dimensions against:
//   • ASME B36.10M (Welded & Seamless Wrought Steel Pipe)
//   • ASME B36.19M (Stainless Steel Pipe)
//   • ASME B16.9   (Factory-Made Wrought Fittings)
//   • Applicable manufacturer catalogs
//   • Your company or project engineering standards
//
// Wall thickness values are in INCHES.
// Outside diameter values are in INCHES.
// Center-to-face values are in INCHES.
// ============================================================

// ------------------------------------------------------------
// PIPE MATERIALS
// ------------------------------------------------------------
export type PipeMaterial =
  | 'carbon_steel'
  | 'stainless_steel'
  | 'chrome_moly'
  | 'pvc'
  | 'custom'

export const PIPE_MATERIALS: { value: PipeMaterial; label: string }[] = [
  { value: 'carbon_steel',    label: 'Carbon Steel' },
  { value: 'stainless_steel', label: 'Stainless Steel' },
  { value: 'chrome_moly',     label: 'Chrome-Moly (P91 / P22)' },
  { value: 'pvc',             label: 'PVC' },
  { value: 'custom',          label: 'Custom / Other' },
]

// ------------------------------------------------------------
// PIPE SCHEDULES
// ------------------------------------------------------------
export type PipeSchedule =
  | 'sch_5'
  | 'sch_10'
  | 'sch_20'
  | 'sch_40'
  | 'sch_80'
  | 'sch_120'
  | 'sch_160'
  | 'xxh'
  | 'custom'

export const PIPE_SCHEDULES: { value: PipeSchedule; label: string }[] = [
  { value: 'sch_5',   label: 'Sch 5' },
  { value: 'sch_10',  label: 'Sch 10' },
  { value: 'sch_20',  label: 'Sch 20' },
  { value: 'sch_40',  label: 'Sch 40 (STD)' },
  { value: 'sch_80',  label: 'Sch 80 (XH)' },
  { value: 'sch_120', label: 'Sch 120' },
  { value: 'sch_160', label: 'Sch 160' },
  { value: 'xxh',     label: 'XXH (Double Extra Heavy)' },
  { value: 'custom',  label: 'Custom Wall' },
]

// ------------------------------------------------------------
// NPS SIZES
// NPS = Nominal Pipe Size. Not the actual OD — just the name.
// ------------------------------------------------------------
export type NpsSize =
  | '0.5' | '0.75' | '1' | '1.25' | '1.5' | '2' | '2.5'
  | '3' | '3.5' | '4' | '5' | '6' | '8' | '10' | '12'
  | '14' | '16' | '18' | '20' | '22' | '24'

export const NPS_SIZES: { value: NpsSize; label: string }[] = [
  { value: '0.5',  label: '1/2"' },
  { value: '0.75', label: '3/4"' },
  { value: '1',    label: '1"' },
  { value: '1.25', label: '1-1/4"' },
  { value: '1.5',  label: '1-1/2"' },
  { value: '2',    label: '2"' },
  { value: '2.5',  label: '2-1/2"' },
  { value: '3',    label: '3"' },
  { value: '3.5',  label: '3-1/2"' },
  { value: '4',    label: '4"' },
  { value: '5',    label: '5"' },
  { value: '6',    label: '6"' },
  { value: '8',    label: '8"' },
  { value: '10',   label: '10"' },
  { value: '12',   label: '12"' },
  { value: '14',   label: '14"' },
  { value: '16',   label: '16"' },
  { value: '18',   label: '18"' },
  { value: '20',   label: '20"' },
  { value: '22',   label: '22"' },
  { value: '24',   label: '24"' },
]

// ------------------------------------------------------------
// OUTSIDE DIAMETER (OD) TABLE
// Source: ASME B36.10M / B36.19M [SAMPLE — verify before use]
// Key: NPS string → OD in inches
// ------------------------------------------------------------
export const PIPE_OD_TABLE: Record<NpsSize, number> = {
  '0.5':  0.840,
  '0.75': 1.050,
  '1':    1.315,
  '1.25': 1.660,
  '1.5':  1.900,
  '2':    2.375,
  '2.5':  2.875,
  '3':    3.500,
  '3.5':  4.000,
  '4':    4.500,
  '5':    5.563,
  '6':    6.625,
  '8':    8.625,
  '10':   10.750,
  '12':   12.750,
  '14':   14.000,
  '16':   16.000,
  '18':   18.000,
  '20':   20.000,
  '22':   22.000,
  '24':   24.000,
}

// ------------------------------------------------------------
// WALL THICKNESS TABLE
// Source: ASME B36.10M [SAMPLE — verify before use]
// Key: NPS → Schedule → wall thickness in inches
// null = schedule not standard for that NPS
// ------------------------------------------------------------
export type WallThicknessTable = Partial<Record<PipeSchedule, number | null>>

export const PIPE_WALL_TABLE: Record<NpsSize, WallThicknessTable> = {
  '0.5': {
    sch_5:   0.065,
    sch_10:  0.083,
    sch_40:  0.109,
    sch_80:  0.147,
    sch_160: 0.187,
    xxh:     0.294,
  },
  '0.75': {
    sch_5:   0.065,
    sch_10:  0.083,
    sch_40:  0.113,
    sch_80:  0.154,
    sch_160: 0.219,
    xxh:     0.308,
  },
  '1': {
    sch_5:   0.065,
    sch_10:  0.109,
    sch_40:  0.133,
    sch_80:  0.179,
    sch_160: 0.250,
    xxh:     0.358,
  },
  '1.25': {
    sch_5:   0.065,
    sch_10:  0.109,
    sch_40:  0.140,
    sch_80:  0.191,
    sch_160: 0.250,
    xxh:     0.382,
  },
  '1.5': {
    sch_5:   0.065,
    sch_10:  0.109,
    sch_40:  0.145,
    sch_80:  0.200,
    sch_160: 0.281,
    xxh:     0.400,
  },
  '2': {
    sch_5:   0.065,
    sch_10:  0.109,
    sch_40:  0.154,
    sch_80:  0.218,
    sch_160: 0.343,
    xxh:     0.436,
  },
  '2.5': {
    sch_5:   0.083,
    sch_10:  0.120,
    sch_40:  0.203,
    sch_80:  0.276,
    sch_160: 0.375,
    xxh:     0.552,
  },
  '3': {
    sch_5:   0.083,
    sch_10:  0.120,
    sch_40:  0.216,
    sch_80:  0.300,
    sch_160: 0.437,
    xxh:     0.600,
  },
  '3.5': {
    sch_5:   0.083,
    sch_10:  0.120,
    sch_40:  0.226,
    sch_80:  0.318,
  },
  '4': {
    sch_5:   0.083,
    sch_10:  0.120,
    sch_40:  0.237,
    sch_80:  0.337,
    sch_120: 0.437,
    sch_160: 0.531,
    xxh:     0.674,
  },
  '5': {
    sch_5:   0.109,
    sch_10:  0.134,
    sch_40:  0.258,
    sch_80:  0.375,
    sch_120: 0.500,
    sch_160: 0.625,
    xxh:     0.750,
  },
  '6': {
    sch_5:   0.109,
    sch_10:  0.134,
    sch_40:  0.280,
    sch_80:  0.432,
    sch_120: 0.562,
    sch_160: 0.718,
    xxh:     0.864,
  },
  '8': {
    sch_5:   0.109,
    sch_10:  0.148,
    sch_20:  0.250,
    sch_40:  0.322,
    sch_80:  0.500,
    sch_120: 0.593,
    sch_160: 0.718,
    xxh:     0.875,
  },
  '10': {
    sch_5:   0.134,
    sch_10:  0.165,
    sch_20:  0.250,
    sch_40:  0.365,
    sch_80:  0.500,
    sch_120: 0.593,
    sch_160: 0.843,
    xxh:     1.000,
  },
  '12': {
    sch_5:   0.156,
    sch_10:  0.180,
    sch_20:  0.250,
    sch_40:  0.406,
    sch_80:  0.500,
    sch_120: 0.687,
    sch_160: 0.843,
    xxh:     1.000,
  },
  '14': {
    sch_5:   0.156,
    sch_10:  0.188,
    sch_20:  0.250,
    sch_40:  0.375,
    sch_80:  0.500,
    sch_120: 0.593,
    sch_160: 0.750,
    xxh:     0.937,
  },
  '16': {
    sch_5:   0.165,
    sch_10:  0.188,
    sch_20:  0.250,
    sch_40:  0.375,
    sch_80:  0.500,
    sch_120: 0.656,
    sch_160: 0.843,
    xxh:     1.031,
  },
  '18': {
    sch_5:   0.165,
    sch_10:  0.188,
    sch_20:  0.250,
    sch_40:  0.375,
    sch_80:  0.500,
    sch_120: 0.750,
    sch_160: 0.937,
    xxh:     1.156,
  },
  '20': {
    sch_5:   0.188,
    sch_10:  0.218,
    sch_20:  0.250,
    sch_40:  0.375,
    sch_80:  0.500,
    sch_120: 0.812,
    sch_160: 1.031,
    xxh:     1.281,
  },
  '22': {
    sch_5:   0.188,
    sch_10:  0.218,
    sch_20:  0.250,
    sch_40:  0.375,
    sch_80:  0.500,
  },
  '24': {
    sch_5:   0.218,
    sch_10:  0.250,
    sch_20:  0.250,
    sch_40:  0.375,
    sch_80:  0.500,
    sch_120: 0.968,
    sch_160: 1.218,
    xxh:     1.531,
  },
}

// ------------------------------------------------------------
// FITTING TYPES
// ------------------------------------------------------------
export type FittingType =
  | 'elbow_90_lr'
  | 'elbow_90_sr'
  | 'elbow_45'
  | 'tee'
  | 'reducer'
  | 'cap'
  | 'stub_end'
  | 'custom'

export const FITTING_TYPES: { value: FittingType; label: string; shortLabel: string }[] = [
  { value: 'elbow_90_lr', label: '90° Long Radius Elbow (LR)',  shortLabel: '90° LR Elbow' },
  { value: 'elbow_90_sr', label: '90° Short Radius Elbow (SR)', shortLabel: '90° SR Elbow' },
  { value: 'elbow_45',    label: '45° Elbow',                   shortLabel: '45° Elbow' },
  { value: 'tee',         label: 'Tee (Run / Branch)',          shortLabel: 'Tee' },
  { value: 'reducer',     label: 'Concentric / Eccentric Reducer', shortLabel: 'Reducer' },
  { value: 'cap',         label: 'End Cap',                     shortLabel: 'Cap' },
  { value: 'stub_end',    label: 'Stub End (Lap Joint)',        shortLabel: 'Stub End' },
  { value: 'custom',      label: 'Custom Fitting',              shortLabel: 'Custom' },
]

// ------------------------------------------------------------
// CENTER-TO-FACE (CTF) DIMENSIONS — ASME B16.9
//
// [SAMPLE VALUES — verify against ASME B16.9 and manufacturer data]
//
// For standard sizes:
//   90° LR Elbow CTF = 1.5 × NPS (exact for most sizes)
//   90° SR Elbow CTF = 1.0 × NPS (exact for most sizes)
//   45° Elbow    CTF varies by NPS (tabulated below)
//   Tee          CTF = 1.0 × NPS (run/branch, most sizes)
//
// Structure: fittingType → NPS → center-to-face in INCHES
// ------------------------------------------------------------

// 90° LR Elbow — CTF = 1.5 × NPS (derived, close to ASME B16.9)
export function get90LRElbowCTF(nps: number): number {
  return 1.5 * nps
}

// 90° SR Elbow — CTF = 1.0 × NPS
export function get90SRElbowCTF(nps: number): number {
  return 1.0 * nps
}

// 45° Elbow — center-to-face tabulated values [SAMPLE]
// Source: representative of ASME B16.9 Table 5
export const CTF_45_ELBOW: Record<NpsSize, number> = {
  '0.5':  0.62,
  '0.75': 0.69,
  '1':    0.81,
  '1.25': 0.94,
  '1.5':  1.00,
  '2':    1.25,
  '2.5':  1.50,
  '3':    1.69,
  '3.5':  1.94,
  '4':    2.00,
  '5':    2.44,
  '6':    2.88,
  '8':    3.75,
  '10':   4.56,
  '12':   5.44,
  '14':   5.75,
  '16':   6.56,
  '18':   7.38,
  '20':   8.19,
  '22':   9.00,
  '24':   9.81,
}

// Tee — center-to-face (run direction) [SAMPLE based on ASME B16.9]
export const CTF_TEE: Record<NpsSize, number> = {
  '0.5':  0.88,
  '0.75': 0.94,
  '1':    1.12,
  '1.25': 1.25,
  '1.5':  1.38,
  '2':    1.50,
  '2.5':  1.75,
  '3':    2.00,
  '3.5':  2.25,
  '4':    2.25,
  '5':    2.50,
  '6':    2.88,
  '8':    3.50,
  '10':   4.00,
  '12':   4.62,
  '14':   5.00,
  '16':   5.50,
  '18':   6.00,
  '20':   6.50,
  '22':   7.00,
  '24':   7.50,
}

// ------------------------------------------------------------
// WELD GAP OPTIONS
// ------------------------------------------------------------
export type WeldGapOption = '3/32' | '1/8' | '3/16' | 'custom'

export const WELD_GAP_OPTIONS: { value: WeldGapOption; label: string; inches: number | null }[] = [
  { value: '3/32',   label: '3/32" (0.094")',  inches: 3/32 },
  { value: '1/8',    label: '1/8" (0.125")',   inches: 1/8 },
  { value: '3/16',   label: '3/16" (0.188")',  inches: 3/16 },
  { value: 'custom', label: 'Custom',           inches: null },
]

// ------------------------------------------------------------
// OFFSET ANGLE OPTIONS
// ------------------------------------------------------------
export type OffsetAngle = '22.5' | '30' | '45' | '60' | 'custom'

export const OFFSET_ANGLES: { value: OffsetAngle; label: string; degrees: number | null }[] = [
  { value: '22.5',  label: '22.5°',  degrees: 22.5 },
  { value: '30',    label: '30°',    degrees: 30 },
  { value: '45',    label: '45°',    degrees: 45 },
  { value: '60',    label: '60°',    degrees: 60 },
  { value: 'custom', label: 'Custom', degrees: null },
]

// ------------------------------------------------------------
// LOOKUP HELPERS
// ------------------------------------------------------------

/** Get the outside diameter for an NPS size. Returns null if not found. */
export function getPipeOD(nps: NpsSize): number | null {
  return PIPE_OD_TABLE[nps] ?? null
}

/** Get wall thickness. Returns null if the schedule is not standard for that NPS. */
export function getWallThickness(nps: NpsSize, schedule: PipeSchedule): number | null {
  return PIPE_WALL_TABLE[nps]?.[schedule] ?? null
}

/** Get inside diameter = OD - (2 × wall thickness) */
export function getPipeID(nps: NpsSize, schedule: PipeSchedule): number | null {
  const od = getPipeOD(nps)
  const wall = getWallThickness(nps, schedule)
  if (od === null || wall === null) return null
  return od - 2 * wall
}

/** Get center-to-face for a given fitting type and NPS */
export function getCenterToFace(fittingType: FittingType, nps: NpsSize): number | null {
  const npsNum = parseFloat(nps)
  switch (fittingType) {
    case 'elbow_90_lr':  return get90LRElbowCTF(npsNum)
    case 'elbow_90_sr':  return get90SRElbowCTF(npsNum)
    case 'elbow_45':     return CTF_45_ELBOW[nps] ?? null
    case 'tee':          return CTF_TEE[nps] ?? null
    case 'cap':          return null // Back of cap varies — requires manufacturer data
    case 'stub_end':     return null // Requires manufacturer data
    case 'reducer':      return null // Requires face-to-face data
    case 'custom':       return null
    default:             return null
  }
}

// ============================================================
// PipeField OS — Piping Reference Data
//
// IMPORTANT: All values are [SAMPLE] representative values
// sourced from public ASME/MSS standards for demonstration.
// Verify against current editions before use in fabrication.
//
// Sources:
//   ASME B16.5  — Pipe Flanges and Flanged Fittings
//   ASME B16.10 — Face-to-Face and End-to-End Dimensions of Valves
//   MSS SP-58   — Pipe Hangers and Supports — Materials, Design and Manufacture
//   MSS SP-69   — Pipe Hangers and Supports — Selection and Application
// ============================================================

import type { NpsSize } from './pipe-data'

// ── Flange Classes (ASME B16.5) ────────────────────────────────
// Pressure ratings in PSI at 100°F for Group 1.1 (A105 / WCB carbon steel)
// Source: ASME B16.5-2017 Table 2-1.1

export type FlangeClass = 150 | 300 | 600 | 900 | 1500 | 2500

export const FLANGE_CLASSES: FlangeClass[] = [150, 300, 600, 900, 1500, 2500]

export const FLANGE_PRESSURE_RATING_PSI: Record<FlangeClass, number> = {
  150:  285,
  300:  740,
  600:  1480,
  900:  2220,
  1500: 3705,
  2500: 6170,
}

// Flange dimensions by NPS and class [SAMPLE — ASME B16.5 Tables]
// Fields: flange OD (in), bolt circle dia (in), number of bolts, bolt dia (in), raised face dia (in)
export interface FlangeDims {
  flange_od_in:      number
  bolt_circle_in:    number
  num_bolts:         number
  bolt_dia_in:       number
  raised_face_dia_in: number
  min_thickness_in:  number
}

export const FLANGE_DIMS: Partial<Record<NpsSize, Record<FlangeClass, FlangeDims>>> = {
  '0.5': {
    150:  { flange_od_in: 3.50,  bolt_circle_in: 2.38,  num_bolts: 4,  bolt_dia_in: 0.50, raised_face_dia_in: 1.38,  min_thickness_in: 0.44 },
    300:  { flange_od_in: 3.75,  bolt_circle_in: 2.63,  num_bolts: 4,  bolt_dia_in: 0.63, raised_face_dia_in: 1.38,  min_thickness_in: 0.56 },
    600:  { flange_od_in: 3.75,  bolt_circle_in: 2.63,  num_bolts: 4,  bolt_dia_in: 0.63, raised_face_dia_in: 1.38,  min_thickness_in: 0.69 },
    900:  { flange_od_in: 4.75,  bolt_circle_in: 3.25,  num_bolts: 4,  bolt_dia_in: 0.75, raised_face_dia_in: 1.38,  min_thickness_in: 0.88 },
    1500: { flange_od_in: 4.75,  bolt_circle_in: 3.25,  num_bolts: 4,  bolt_dia_in: 0.75, raised_face_dia_in: 1.38,  min_thickness_in: 1.00 },
    2500: { flange_od_in: 5.25,  bolt_circle_in: 3.50,  num_bolts: 4,  bolt_dia_in: 0.75, raised_face_dia_in: 1.56,  min_thickness_in: 1.19 },
  },
  '1': {
    150:  { flange_od_in: 4.25,  bolt_circle_in: 3.12,  num_bolts: 4,  bolt_dia_in: 0.50, raised_face_dia_in: 1.69,  min_thickness_in: 0.50 },
    300:  { flange_od_in: 4.88,  bolt_circle_in: 3.50,  num_bolts: 4,  bolt_dia_in: 0.63, raised_face_dia_in: 1.69,  min_thickness_in: 0.63 },
    600:  { flange_od_in: 4.88,  bolt_circle_in: 3.50,  num_bolts: 4,  bolt_dia_in: 0.63, raised_face_dia_in: 1.69,  min_thickness_in: 0.88 },
    900:  { flange_od_in: 5.88,  bolt_circle_in: 4.00,  num_bolts: 4,  bolt_dia_in: 0.88, raised_face_dia_in: 1.69,  min_thickness_in: 1.13 },
    1500: { flange_od_in: 5.88,  bolt_circle_in: 4.00,  num_bolts: 4,  bolt_dia_in: 0.88, raised_face_dia_in: 1.69,  min_thickness_in: 1.25 },
    2500: { flange_od_in: 6.25,  bolt_circle_in: 4.38,  num_bolts: 4,  bolt_dia_in: 0.88, raised_face_dia_in: 2.00,  min_thickness_in: 1.56 },
  },
  '2': {
    150:  { flange_od_in: 6.00,  bolt_circle_in: 4.75,  num_bolts: 4,  bolt_dia_in: 0.63, raised_face_dia_in: 2.69,  min_thickness_in: 0.63 },
    300:  { flange_od_in: 6.50,  bolt_circle_in: 5.00,  num_bolts: 8,  bolt_dia_in: 0.63, raised_face_dia_in: 2.69,  min_thickness_in: 0.75 },
    600:  { flange_od_in: 6.50,  bolt_circle_in: 5.00,  num_bolts: 8,  bolt_dia_in: 0.63, raised_face_dia_in: 2.69,  min_thickness_in: 1.00 },
    900:  { flange_od_in: 8.50,  bolt_circle_in: 6.50,  num_bolts: 8,  bolt_dia_in: 0.88, raised_face_dia_in: 2.69,  min_thickness_in: 1.50 },
    1500: { flange_od_in: 8.50,  bolt_circle_in: 6.50,  num_bolts: 8,  bolt_dia_in: 0.88, raised_face_dia_in: 2.69,  min_thickness_in: 1.63 },
    2500: { flange_od_in: 9.25,  bolt_circle_in: 6.75,  num_bolts: 8,  bolt_dia_in: 1.00, raised_face_dia_in: 3.00,  min_thickness_in: 2.25 },
  },
  '4': {
    150:  { flange_od_in: 9.00,  bolt_circle_in: 7.50,  num_bolts: 8,  bolt_dia_in: 0.63, raised_face_dia_in: 4.75,  min_thickness_in: 0.69 },
    300:  { flange_od_in: 10.00, bolt_circle_in: 8.25,  num_bolts: 8,  bolt_dia_in: 0.75, raised_face_dia_in: 4.75,  min_thickness_in: 0.94 },
    600:  { flange_od_in: 10.75, bolt_circle_in: 8.50,  num_bolts: 8,  bolt_dia_in: 0.88, raised_face_dia_in: 4.75,  min_thickness_in: 1.38 },
    900:  { flange_od_in: 12.25, bolt_circle_in: 9.50,  num_bolts: 8,  bolt_dia_in: 1.13, raised_face_dia_in: 4.75,  min_thickness_in: 1.88 },
    1500: { flange_od_in: 13.75, bolt_circle_in: 10.75, num_bolts: 8,  bolt_dia_in: 1.25, raised_face_dia_in: 4.75,  min_thickness_in: 2.44 },
    2500: { flange_od_in: 15.00, bolt_circle_in: 11.50, num_bolts: 8,  bolt_dia_in: 1.50, raised_face_dia_in: 5.19,  min_thickness_in: 3.44 },
  },
  '6': {
    150:  { flange_od_in: 11.00, bolt_circle_in: 9.50,  num_bolts: 8,  bolt_dia_in: 0.75, raised_face_dia_in: 6.88,  min_thickness_in: 0.88 },
    300:  { flange_od_in: 12.50, bolt_circle_in: 10.62, num_bolts: 12, bolt_dia_in: 0.75, raised_face_dia_in: 6.88,  min_thickness_in: 1.00 },
    600:  { flange_od_in: 14.00, bolt_circle_in: 11.50, num_bolts: 12, bolt_dia_in: 1.00, raised_face_dia_in: 6.88,  min_thickness_in: 1.63 },
    900:  { flange_od_in: 15.00, bolt_circle_in: 12.50, num_bolts: 12, bolt_dia_in: 1.13, raised_face_dia_in: 6.88,  min_thickness_in: 2.19 },
    1500: { flange_od_in: 17.50, bolt_circle_in: 14.00, num_bolts: 12, bolt_dia_in: 1.25, raised_face_dia_in: 6.88,  min_thickness_in: 3.25 },
    2500: { flange_od_in: 20.00, bolt_circle_in: 15.75, num_bolts: 12, bolt_dia_in: 1.63, raised_face_dia_in: 7.31,  min_thickness_in: 4.63 },
  },
  '8': {
    150:  { flange_od_in: 13.50, bolt_circle_in: 11.75, num_bolts: 8,  bolt_dia_in: 0.75, raised_face_dia_in: 8.75,  min_thickness_in: 0.94 },
    300:  { flange_od_in: 15.00, bolt_circle_in: 13.00, num_bolts: 12, bolt_dia_in: 0.88, raised_face_dia_in: 8.75,  min_thickness_in: 1.13 },
    600:  { flange_od_in: 16.50, bolt_circle_in: 13.75, num_bolts: 12, bolt_dia_in: 1.13, raised_face_dia_in: 8.75,  min_thickness_in: 1.75 },
    900:  { flange_od_in: 18.50, bolt_circle_in: 15.50, num_bolts: 12, bolt_dia_in: 1.25, raised_face_dia_in: 8.75,  min_thickness_in: 2.50 },
    1500: { flange_od_in: 21.75, bolt_circle_in: 17.75, num_bolts: 12, bolt_dia_in: 1.63, raised_face_dia_in: 8.75,  min_thickness_in: 3.75 },
    2500: { flange_od_in: 24.25, bolt_circle_in: 19.75, num_bolts: 12, bolt_dia_in: 1.88, raised_face_dia_in: 9.19,  min_thickness_in: 5.44 },
  },
  '10': {
    150:  { flange_od_in: 16.00, bolt_circle_in: 14.25, num_bolts: 12, bolt_dia_in: 0.88, raised_face_dia_in: 10.88, min_thickness_in: 1.00 },
    300:  { flange_od_in: 17.50, bolt_circle_in: 15.25, num_bolts: 16, bolt_dia_in: 1.00, raised_face_dia_in: 10.88, min_thickness_in: 1.25 },
    600:  { flange_od_in: 20.00, bolt_circle_in: 17.00, num_bolts: 16, bolt_dia_in: 1.25, raised_face_dia_in: 10.88, min_thickness_in: 2.00 },
    900:  { flange_od_in: 23.00, bolt_circle_in: 19.25, num_bolts: 16, bolt_dia_in: 1.50, raised_face_dia_in: 10.88, min_thickness_in: 2.88 },
    1500: { flange_od_in: 26.50, bolt_circle_in: 21.25, num_bolts: 16, bolt_dia_in: 1.88, raised_face_dia_in: 10.88, min_thickness_in: 4.25 },
    2500: { flange_od_in: 31.00, bolt_circle_in: 25.50, num_bolts: 16, bolt_dia_in: 2.25, raised_face_dia_in: 11.25, min_thickness_in: 6.25 },
  },
  '12': {
    150:  { flange_od_in: 19.00, bolt_circle_in: 17.00, num_bolts: 12, bolt_dia_in: 0.88, raised_face_dia_in: 13.00, min_thickness_in: 1.00 },
    300:  { flange_od_in: 20.50, bolt_circle_in: 17.75, num_bolts: 16, bolt_dia_in: 1.13, raised_face_dia_in: 13.00, min_thickness_in: 1.38 },
    600:  { flange_od_in: 22.00, bolt_circle_in: 19.25, num_bolts: 20, bolt_dia_in: 1.25, raised_face_dia_in: 13.00, min_thickness_in: 2.19 },
    900:  { flange_od_in: 26.50, bolt_circle_in: 22.50, num_bolts: 20, bolt_dia_in: 1.50, raised_face_dia_in: 13.00, min_thickness_in: 3.25 },
    1500: { flange_od_in: 30.00, bolt_circle_in: 25.00, num_bolts: 20, bolt_dia_in: 1.88, raised_face_dia_in: 13.00, min_thickness_in: 4.88 },
    2500: { flange_od_in: 35.50, bolt_circle_in: 29.50, num_bolts: 20, bolt_dia_in: 2.50, raised_face_dia_in: 13.50, min_thickness_in: 7.25 },
  },
}

// ── Valve Face-to-Face (ASME B16.10) ──────────────────────────
// All dimensions in INCHES [SAMPLE]
// Classes: 150#, 300#, 600# representative values

export type ValveType = 'gate' | 'globe' | 'check_swing' | 'ball' | 'butterfly'

export const VALVE_TYPE_LABELS: Record<ValveType, string> = {
  gate:         'Gate Valve',
  globe:        'Globe Valve',
  check_swing:  'Swing Check',
  ball:         'Ball Valve (Full Port)',
  butterfly:    'Butterfly Valve (Wafer)',
}

export interface ValveFtF {
  class_150: number | null
  class_300: number | null
  class_600: number | null
}

export const VALVE_FTF: Partial<Record<NpsSize, Record<ValveType, ValveFtF>>> = {
  '1': {
    gate:        { class_150: 5.50,  class_300: 6.50,  class_600: 6.50  },
    globe:       { class_150: 6.50,  class_300: 7.50,  class_600: 7.50  },
    check_swing: { class_150: 5.00,  class_300: 6.50,  class_600: 6.50  },
    ball:        { class_150: 5.00,  class_300: 6.00,  class_600: null  },
    butterfly:   { class_150: 2.00,  class_300: 2.00,  class_600: null  },
  },
  '2': {
    gate:        { class_150: 7.00,  class_300: 8.50,  class_600: 8.50  },
    globe:       { class_150: 8.50,  class_300: 9.50,  class_600: 9.50  },
    check_swing: { class_150: 6.50,  class_300: 8.50,  class_600: 8.50  },
    ball:        { class_150: 6.50,  class_300: 8.00,  class_600: null  },
    butterfly:   { class_150: 2.62,  class_300: 2.62,  class_600: null  },
  },
  '3': {
    gate:        { class_150: 8.00,  class_300: 11.12, class_600: 11.12 },
    globe:       { class_150: 9.50,  class_300: 13.00, class_600: 13.00 },
    check_swing: { class_150: 7.50,  class_300: 11.12, class_600: 11.12 },
    ball:        { class_150: 7.50,  class_300: 9.75,  class_600: null  },
    butterfly:   { class_150: 3.00,  class_300: 3.00,  class_600: null  },
  },
  '4': {
    gate:        { class_150: 9.00,  class_300: 12.00, class_600: 13.00 },
    globe:       { class_150: 11.50, class_300: 14.00, class_600: 15.00 },
    check_swing: { class_150: 9.00,  class_300: 12.00, class_600: 13.00 },
    ball:        { class_150: 9.00,  class_300: 11.50, class_600: null  },
    butterfly:   { class_150: 3.50,  class_300: 3.50,  class_600: null  },
  },
  '6': {
    gate:        { class_150: 10.50, class_300: 15.00, class_600: 16.50 },
    globe:       { class_150: 14.00, class_300: 18.50, class_600: 20.00 },
    check_swing: { class_150: 10.50, class_300: 15.00, class_600: 16.50 },
    ball:        { class_150: 10.50, class_300: 14.00, class_600: null  },
    butterfly:   { class_150: 4.19,  class_300: 4.19,  class_600: null  },
  },
  '8': {
    gate:        { class_150: 11.50, class_300: 18.00, class_600: 20.00 },
    globe:       { class_150: 17.00, class_300: 22.00, class_600: 25.00 },
    check_swing: { class_150: 11.50, class_300: 18.00, class_600: 20.00 },
    ball:        { class_150: 11.50, class_300: 17.00, class_600: null  },
    butterfly:   { class_150: 5.00,  class_300: 5.00,  class_600: null  },
  },
  '10': {
    gate:        { class_150: 15.00, class_300: 22.50, class_600: 25.00 },
    globe:       { class_150: 20.50, class_300: 27.50, class_600: 30.00 },
    check_swing: { class_150: 15.00, class_300: 22.50, class_600: 25.00 },
    ball:        { class_150: 15.00, class_300: 21.00, class_600: null  },
    butterfly:   { class_150: 5.81,  class_300: 5.81,  class_600: null  },
  },
  '12': {
    gate:        { class_150: 16.50, class_300: 26.00, class_600: 28.00 },
    globe:       { class_150: 24.00, class_300: 32.00, class_600: 36.00 },
    check_swing: { class_150: 16.50, class_300: 26.00, class_600: 28.00 },
    ball:        { class_150: 16.50, class_300: 25.00, class_600: null  },
    butterfly:   { class_150: 6.50,  class_300: 6.50,  class_600: null  },
  },
}

// ── MSS SP-58 / SP-69 Support Span Table ──────────────────────
// Max recommended support span (ft) for water-filled CS pipe
// Source: MSS SP-69 Table 3 [SAMPLE]

export const SP69_SPAN_TABLE: Partial<Record<NpsSize, {
  water_ft: number
  steam_ft: number
  gas_ft:   number
}>> = {
  '0.5':  { water_ft: 7,  steam_ft: 9,  gas_ft: 11 },
  '0.75': { water_ft: 7,  steam_ft: 9,  gas_ft: 11 },
  '1':    { water_ft: 7,  steam_ft: 9,  gas_ft: 11 },
  '1.25': { water_ft: 7,  steam_ft: 9,  gas_ft: 13 },
  '1.5':  { water_ft: 9,  steam_ft: 11, gas_ft: 13 },
  '2':    { water_ft: 10, steam_ft: 13, gas_ft: 15 },
  '2.5':  { water_ft: 11, steam_ft: 14, gas_ft: 16 },
  '3':    { water_ft: 12, steam_ft: 15, gas_ft: 17 },
  '3.5':  { water_ft: 13, steam_ft: 16, gas_ft: 18 },
  '4':    { water_ft: 14, steam_ft: 17, gas_ft: 19 },
  '5':    { water_ft: 16, steam_ft: 19, gas_ft: 22 },
  '6':    { water_ft: 17, steam_ft: 21, gas_ft: 24 },
  '8':    { water_ft: 19, steam_ft: 24, gas_ft: 27 },
  '10':   { water_ft: 22, steam_ft: 26, gas_ft: 30 },
  '12':   { water_ft: 23, steam_ft: 30, gas_ft: 33 },
  '14':   { water_ft: 25, steam_ft: 32, gas_ft: 35 },
  '16':   { water_ft: 27, steam_ft: 35, gas_ft: 38 },
  '18':   { water_ft: 28, steam_ft: 37, gas_ft: 41 },
  '20':   { water_ft: 30, steam_ft: 39, gas_ft: 44 },
  '24':   { water_ft: 32, steam_ft: 42, gas_ft: 48 },
}

// ── Unit conversion helpers ───────────────────────────────────

export function inToMm(inches: number): number {
  return Math.round(inches * 25.4 * 100) / 100
}

export function mmToIn(mm: number): number {
  return Math.round((mm / 25.4) * 10000) / 10000
}

export function ftToM(ft: number): number {
  return Math.round(ft * 0.3048 * 1000) / 1000
}

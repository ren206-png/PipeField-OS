// ============================================================
// src/lib/turnover/pdf-renderer.ts
// Renders a turnover package as a PDF buffer using
// @react-pdf/renderer v4.
//
// Page size respects project.page_size ('letter' | 'A4').
// All elements use React.createElement (no JSX) to match the
// existing codebase pattern (see weld-log-pdf/route.ts).
// ============================================================
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type {
  TurnoverPackageData,
  TurnoverWeld,
  TurnoverNdeRecord,
  TurnoverMtr,
  TurnoverPressureTest,
  TurnoverSignature,
} from './builder'

// ── Brand colours ─────────────────────────────────────────────
const C = {
  bg:      '#0f172a',
  surface: '#1e293b',
  border:  '#334155',
  orange:  '#f97316',
  white:   '#f1f5f9',
  muted:   '#94a3b8',
  green:   '#4ade80',
  red:     '#f87171',
  yellow:  '#fbbf24',
}

// ── Styles via StyleSheet.create (required for react-pdf types) ─
const S = StyleSheet.create({
  page: {
    fontFamily:        'Helvetica',
    fontSize:          8,
    color:             C.white,
    backgroundColor:   C.bg,
    paddingTop:        36,
    paddingBottom:     48,
    paddingHorizontal: 36,
  },
  sectionTitle: {
    fontFamily:        'Helvetica-Bold',
    fontSize:          11,
    color:             C.orange,
    borderBottomWidth: 1,
    borderBottomColor: C.orange,
    paddingBottom:     5,
    marginBottom:      10,
    marginTop:         4,
  },
  tableHead: {
    flexDirection:     'row',
    backgroundColor:   C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.orange,
    paddingVertical:   4,
    paddingHorizontal: 4,
  },
  th: {
    fontFamily:    'Helvetica-Bold',
    fontSize:      7,
    color:         C.orange,
    textTransform: 'uppercase',
  },
  rowEven: {
    flexDirection:     'row',
    backgroundColor:   C.bg,
    paddingVertical:   3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.surface,
  },
  rowOdd: {
    flexDirection:     'row',
    backgroundColor:   '#111827',
    paddingVertical:   3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.surface,
  },
  td:     { fontSize: 7.5, color: C.white },
  tdMono: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.orange },
  tdMuted:{ fontSize: 7.5, color: C.muted },
  tdGreen:{ fontSize: 7.5, color: C.green },
  tdRed:  { fontSize: 7.5, color: C.red   },
  tdYellow:{ fontSize: 7.5, color: C.yellow },
  footer: {
    position:         'absolute',
    bottom:           20,
    left:             36,
    right:            36,
    flexDirection:    'row',
    justifyContent:   'space-between',
    fontSize:         7,
    color:            C.muted,
    borderTopWidth:   0.5,
    borderTopColor:   C.border,
    paddingTop:       4,
  },
  // Cover
  coverHero: {
    marginTop:       60,
    marginBottom:    40,
    borderLeftWidth: 4,
    borderLeftColor: C.orange,
    paddingLeft:     16,
  },
  coverTitle: { fontFamily: 'Helvetica-Bold', fontSize: 22, color: C.orange, marginBottom: 6 },
  coverSub:   { fontSize: 11, color: C.white, marginBottom: 4 },
  coverMeta:  { fontSize: 8.5, color: C.muted, marginTop: 2 },
  coverTable: { marginTop: 24, borderWidth: 1, borderColor: C.border },
  coverRow:   { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border, paddingVertical: 6, paddingHorizontal: 10 },
  coverLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.muted, width: 140 },
  coverValue: { fontSize: 7.5, color: C.white, flex: 1 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  summaryLabel:{ fontSize: 8, color: C.muted },
  summaryCount:{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.orange },
  // Weld index columns
  cWeldNo:  { width: 65 },
  cSpool:   { width: 70 },
  cLine:    { width: 65 },
  cSize:    { width: 50 },
  cProcess: { width: 55 },
  cWelder:  { width: 95 },
  cDate:    { width: 60 },
  cStatus:  { width: 70 },
  // NDE index columns
  nWeld:    { width: 70 },
  nType:    { width: 55 },
  nReason:  { width: 110 },
  nResult:  { width: 60 },
  nBy:      { width: 100 },
  nRef:     { flex: 1 },
  // MTR columns
  mHeat:    { width: 90 },
  mSpec:    { width: 115 },
  mCert:    { width: 80 },
  mBy:      { width: 100 },
  mHash:    { flex: 1 },
  // Pressure test columns
  pNo:      { width: 65 },
  pCircuit: { width: 110 },
  pPress:   { width: 80 },
  pMedium:  { width: 70 },
  pDate:    { width: 65 },
  pResult:  { width: 60 },
  pWitness: { flex: 1 },
  // Engineering note box
  engBox: {
    marginTop:       24,
    backgroundColor: '#1a0a00',
    borderWidth:     1,
    borderColor:     '#7c2d12',
    padding:         10,
  },
  engTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.yellow, marginBottom: 3 },
  engBody:  { fontSize: 6.5, color: C.muted },
  // Signature blocks
  sigBlock: {
    marginBottom:      20,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  sigHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sigName:    { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.white },
  sigDate:    { fontSize: 7.5, color: C.muted },
  sigRole:    { fontSize: 7.5, color: C.orange, marginBottom: 4 },
  sigHash:    { fontSize: 6.5, color: C.green },
  sigHashNone:{ fontSize: 6.5, color: C.muted },
  sigLine:    { marginTop: 12, borderBottomWidth: 0.5, borderBottomColor: C.border, width: 200 },
  sigLineLabel:{ fontSize: 6.5, color: C.muted, marginTop: 2 },
  // Utility
  emptyMsg:    { fontSize: 8,   color: C.muted, marginTop: 8 },
  hashMono:    { fontFamily: 'Helvetica', fontSize: 6.5, color: C.green },
  hashMonoNone:{ fontFamily: 'Helvetica', fontSize: 6.5, color: C.muted },
  footerText:  { fontSize: 7, color: C.muted },
  coverSectionTitle: {
    fontFamily:        'Helvetica-Bold',
    fontSize:          11,
    color:             C.orange,
    borderBottomWidth: 1,
    borderBottomColor: C.orange,
    paddingBottom:     5,
    marginBottom:      10,
    marginTop:         24,
  },
  coverBorderTable: { borderWidth: 1, borderColor: C.border },
})

// ── Helpers ───────────────────────────────────────────────────
const el = React.createElement

function statusStyle(status: string) {
  const s = status.toLowerCase()
  if (['accepted','complete','pass'].includes(s)) return S.tdGreen
  if (['failed','rejected','fail'].includes(s))  return S.tdRed
  if (['pending','in_progress'].includes(s))      return S.tdYellow
  return S.tdMuted
}

function footer(orgName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return el(View, { style: S.footer, fixed: true } as any,
    el(Text, { style: S.footerText }, `${orgName} — Turnover Package`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    el(Text, {
      style:  S.footerText,
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Page ${pageNumber} of ${totalPages}`,
    } as any),
  )
}

// ── 0. Cover Sheet ────────────────────────────────────────────
function coverSheet(data: TurnoverPackageData, pageSize: 'LETTER' | 'A4') {
  const genDate = new Date(data.generated_at).toLocaleDateString('en-CA')
  const proj = data.project

  const meta: [string, string][] = [
    ['Project',         proj.name + (proj.project_number ? ` [${proj.project_number}]` : '')],
    ['Governing Code',  proj.governing_code ?? '—'],
    ['Jurisdiction',    proj.jurisdiction   ?? '—'],
    ['AHJ',             proj.ahj            ?? '—'],
    ['Unit System',     proj.unit_system    ?? 'imperial'],
    ['Package Name',    data.package_name],
    ['Generated By',    data.org_name],
    ['Generated Date',  genDate],
    ['Package ID',      data.package_id],
  ]

  const contents: [string, number][] = [
    ['Section 1 — Weld Index',            data.weld_count],
    ['Section 2 — NDE Summary',           data.nde_count],
    ['Section 3 — MTR Index',             data.mtr_count],
    ['Section 4 — Pressure Test Records', data.test_count],
    ['Section 5 — Signature Sheet',       data.signatures.length],
  ]

  return el(Page, { size: pageSize, style: S.page } as object,
    el(View, { style: S.coverHero },
      el(Text, { style: S.coverTitle }, 'TURNOVER PACKAGE'),
      el(Text, { style: S.coverSub }, data.package_name),
      el(Text, { style: S.coverMeta }, `${data.org_name}  ·  ${genDate}`),
    ),
    el(View, { style: S.coverTable },
      ...meta.map(([label, value], i) =>
        el(View, { style: S.coverRow, key: `m${i}` },
          el(Text, { style: S.coverLabel }, label),
          el(Text, { style: S.coverValue }, value),
        )
      )
    ),
    el(Text, { style: S.coverSectionTitle }, 'CONTENTS'),
    el(View, { style: S.coverBorderTable },
      ...contents.map(([label, count], i) =>
        el(View, { style: S.summaryRow, key: `c${i}` },
          el(Text, { style: S.summaryLabel }, label),
          el(Text, { style: S.summaryCount }, String(count)),
        )
      )
    ),
    footer(data.org_name),
  )
}

// ── 1. Weld Index ─────────────────────────────────────────────
function weldIndex(data: TurnoverPackageData, pageSize: 'LETTER' | 'A4') {
  const cols = [
    { label: 'Weld No.', style: S.cWeldNo  },
    { label: 'Spool',    style: S.cSpool   },
    { label: 'Line No.', style: S.cLine    },
    { label: 'Size',     style: S.cSize    },
    { label: 'Process',  style: S.cProcess },
    { label: 'Welder',   style: S.cWelder  },
    { label: 'Date',     style: S.cDate    },
    { label: 'Status',   style: S.cStatus  },
  ]

  function weldRow(w: TurnoverWeld, i: number) {
    const welder = [w.welder_name, w.welder_stamp ? `(${w.welder_stamp})` : ''].filter(Boolean).join(' ')
    return el(View, { style: i % 2 === 0 ? S.rowEven : S.rowOdd, key: `w${i}` },
      el(View, { style: S.cWeldNo  }, el(Text, { style: S.tdMono  }, w.weld_id_number)),
      el(View, { style: S.cSpool   }, el(Text, { style: S.tdMuted }, w.spool_number  ?? '—')),
      el(View, { style: S.cLine    }, el(Text, { style: S.tdMuted }, w.line_number   ?? '—')),
      el(View, { style: S.cSize    }, el(Text, { style: S.tdMuted }, w.pipe_size     ?? '—')),
      el(View, { style: S.cProcess }, el(Text, { style: S.tdMuted }, w.weld_process  ?? '—')),
      el(View, { style: S.cWelder  }, el(Text, { style: S.td      }, welder          || '—')),
      el(View, { style: S.cDate    }, el(Text, { style: S.tdMuted }, w.weld_date     ?? '—')),
      el(View, { style: S.cStatus  }, el(Text, { style: statusStyle(w.status) }, w.status)),
    )
  }

  return el(Page, { size: pageSize, style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 1 — WELD INDEX'),
    el(View, { style: S.tableHead },
      ...cols.map((c, i) => el(View, { style: c.style, key: `h${i}` }, el(Text, { style: S.th }, c.label)))
    ),
    ...data.welds.map(weldRow),
    footer(data.org_name),
  )
}

// ── 2. NDE Summary ────────────────────────────────────────────
function ndeIndex(data: TurnoverPackageData, pageSize: 'LETTER' | 'A4') {
  const cols = [
    { label: 'Weld No.',  style: S.nWeld   },
    { label: 'Method',    style: S.nType   },
    { label: 'Reason',    style: S.nReason },
    { label: 'Result',    style: S.nResult },
    { label: 'Inspector', style: S.nBy     },
    { label: 'Report Ref',style: S.nRef    },
  ]

  function ndeRow(r: TurnoverNdeRecord, i: number) {
    const reasonLabel = r.selection_reason === 'progressive_penalty'
      ? 'Progressive Penalty'
      : r.selection_reason === 'repair_followup'
        ? 'Repair Follow-up'
        : 'Random Sample'
    const resultStyle = r.result ? statusStyle(r.result) : S.tdMuted
    return el(View, { style: i % 2 === 0 ? S.rowEven : S.rowOdd, key: `n${i}` },
      el(View, { style: S.nWeld   }, el(Text, { style: S.tdMono   }, r.weld_id_number)),
      el(View, { style: S.nType   }, el(Text, { style: S.td       }, r.inspection_type)),
      el(View, { style: S.nReason }, el(Text, { style: S.tdMuted  }, reasonLabel)),
      el(View, { style: S.nResult }, el(Text, { style: resultStyle }, r.result ?? 'Pending')),
      el(View, { style: S.nBy     }, el(Text, { style: S.tdMuted  }, r.performed_by ?? '—')),
      el(View, { style: S.nRef    }, el(Text, { style: S.tdMuted  }, r.report_ref   ?? '—')),
    )
  }

  return el(Page, { size: pageSize, style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 2 — NDE SUMMARY'),
    data.nde_records.length === 0
      ? el(Text, { style: S.emptyMsg }, 'No NDE selections recorded for this project.')
      : el(React.Fragment, null,
          el(View, { style: S.tableHead },
            ...cols.map((c, i) => el(View, { style: c.style, key: `h${i}` }, el(Text, { style: S.th }, c.label)))
          ),
          ...data.nde_records.map(ndeRow),
        ),
    footer(data.org_name),
  )
}

// ── 3. MTR Index ──────────────────────────────────────────────
function mtrIndex(data: TurnoverPackageData, pageSize: 'LETTER' | 'A4') {
  const cols = [
    { label: 'Heat No.',    style: S.mHeat },
    { label: 'Material',    style: S.mSpec },
    { label: 'Cert Type',   style: S.mCert },
    { label: 'Issued By',   style: S.mBy   },
    { label: 'Doc SHA-256', style: S.mHash },
  ]

  function certLabel(m: TurnoverMtr): string {
    const labels: Record<string, string> = {
      '2.1': 'EN 10204 — 2.1', '2.2': 'EN 10204 — 2.2',
      '3.1': 'EN 10204 — 3.1', '3.2': 'EN 10204 — 3.2',
    }
    return m.cert_type_enum ? (labels[m.cert_type_enum] ?? m.cert_type_enum) : (m.cert_type ?? '—')
  }

  function mtrRow(m: TurnoverMtr, i: number) {
    const hash = m.document_sha256 ? `${m.document_sha256.slice(0, 16)}…` : '—'
    return el(View, { style: i % 2 === 0 ? S.rowEven : S.rowOdd, key: `m${i}` },
      el(View, { style: S.mHeat }, el(Text, { style: S.tdMono  }, m.heat_number)),
      el(View, { style: S.mSpec }, el(Text, { style: S.td      }, m.material_spec ?? '—')),
      el(View, { style: S.mCert }, el(Text, { style: S.td      }, certLabel(m))),
      el(View, { style: S.mBy   }, el(Text, { style: S.tdMuted }, m.issued_by     ?? '—')),
      el(View, { style: S.mHash }, el(Text, { style: m.document_sha256 ? S.hashMono : S.hashMonoNone }, hash)),
    )
  }

  return el(Page, { size: pageSize, style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 3 — MATERIAL TEST REPORT (MTR) INDEX'),
    data.mtrs.length === 0
      ? el(Text, { style: S.emptyMsg }, 'No MTRs recorded for this project.')
      : el(React.Fragment, null,
          el(View, { style: S.tableHead },
            ...cols.map((c, i) => el(View, { style: c.style, key: `h${i}` }, el(Text, { style: S.th }, c.label)))
          ),
          ...data.mtrs.map(mtrRow),
        ),
    footer(data.org_name),
  )
}

// ── 4. Pressure Test Records ──────────────────────────────────
function pressureTestIndex(data: TurnoverPackageData, pageSize: 'LETTER' | 'A4') {
  const cols = [
    { label: 'Test No.',  style: S.pNo      },
    { label: 'Circuit',   style: S.pCircuit },
    { label: 'Pressure',  style: S.pPress   },
    { label: 'Medium',    style: S.pMedium  },
    { label: 'Date',      style: S.pDate    },
    { label: 'Result',    style: S.pResult  },
    { label: 'Witness',   style: S.pWitness },
  ]

  function testRow(t: TurnoverPressureTest, i: number) {
    const pressureStr = t.test_pressure != null
      ? `${t.test_pressure} ${t.pressure_unit ?? 'psi'}`
      : '—'
    const resultStyle = t.result ? statusStyle(t.result) : S.tdMuted
    return el(View, { style: i % 2 === 0 ? S.rowEven : S.rowOdd, key: `t${i}` },
      el(View, { style: S.pNo      }, el(Text, { style: S.tdMono   }, t.test_number  ?? '—')),
      el(View, { style: S.pCircuit }, el(Text, { style: S.td       }, t.circuit      ?? '—')),
      el(View, { style: S.pPress   }, el(Text, { style: S.td       }, pressureStr)),
      el(View, { style: S.pMedium  }, el(Text, { style: S.tdMuted  }, t.test_medium  ?? '—')),
      el(View, { style: S.pDate    }, el(Text, { style: S.tdMuted  }, t.test_date    ?? '—')),
      el(View, { style: S.pResult  }, el(Text, { style: resultStyle }, t.result ?? 'Pending')),
      el(View, { style: S.pWitness }, el(Text, { style: S.tdMuted  }, t.witnessed_by ?? '—')),
    )
  }

  return el(Page, { size: pageSize, style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 4 — PRESSURE TEST RECORDS'),
    data.pressure_tests.length === 0
      ? el(Text, { style: S.emptyMsg }, 'No pressure test records for this project.')
      : el(React.Fragment, null,
          el(View, { style: S.tableHead },
            ...cols.map((c, i) => el(View, { style: c.style, key: `h${i}` }, el(Text, { style: S.th }, c.label)))
          ),
          ...data.pressure_tests.map(testRow),
        ),
    footer(data.org_name),
  )
}

// ── 5. Signature Sheet ────────────────────────────────────────
function signatureSheet(data: TurnoverPackageData, pageSize: 'LETTER' | 'A4') {
  function sigBlock(s: TurnoverSignature, i: number) {
    const signedDate = new Date(s.signed_at).toLocaleString('en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    return el(View, { style: S.sigBlock, key: `sig${i}` },
      el(View, { style: S.sigHeader },
        el(Text, { style: S.sigName }, s.signer_name),
        el(Text, { style: S.sigDate }, signedDate),
      ),
      el(Text, { style: S.sigRole }, s.role),
      s.content_hash
        ? el(Text, { style: S.sigHash }, `✓ Content hash: ${s.content_hash.slice(0, 32)}…`)
        : el(Text, { style: S.sigHashNone }, 'No content hash recorded'),
      el(View, { style: S.sigLine }),
      el(Text, { style: S.sigLineLabel }, 'Signature'),
    )
  }

  return el(Page, { size: pageSize, style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 5 — SIGNATURE SHEET'),
    data.signatures.length === 0
      ? el(Text, { style: S.emptyMsg }, 'No signatures recorded for this project.')
      : el(React.Fragment, null, ...data.signatures.map(sigBlock)),
    el(View, { style: S.engBox },
      el(Text, { style: S.engTitle }, '⚠️ ENGINEERING REVIEW REQUIRED'),
      el(Text, { style: S.engBody  },
        'This turnover package is generated by PipeField OS and is provided as a reference document only. ' +
        'All data must be verified by a qualified engineer against project records before submission to the client or AHJ.'
      ),
    ),
    footer(data.org_name),
  )
}

// ── Public: render to buffer ──────────────────────────────────
export async function renderTurnoverPdf(data: TurnoverPackageData): Promise<Buffer> {
  const pageSize = data.project.page_size === 'A4' ? 'A4' : 'LETTER'

  const doc = el(Document, { title: data.package_name },
    coverSheet(data, pageSize),
    weldIndex(data, pageSize),
    ndeIndex(data, pageSize),
    mtrIndex(data, pageSize),
    pressureTestIndex(data, pageSize),
    signatureSheet(data, pageSize),
  )

  return renderToBuffer(doc) as Promise<Buffer>
}

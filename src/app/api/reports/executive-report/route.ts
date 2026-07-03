// GET /api/reports/executive-report?projectId=<id>
// Returns an A4 portrait multi-page PDF close-out report for the given project.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api-auth'
import {
  Document, Page, Text as PdfText, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'
const T = PdfText as React.ComponentType<{ style?: object; children?: React.ReactNode; render?: (props: { pageNumber: number; totalPages: number }) => string; fixed?: boolean }>

// ── Palette ────────────────────────────────────────────────────
const C = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  border:   '#334155',
  orange:   '#f97316',
  orangeDim:'#7c2d12',
  white:    '#f8fafc',
  light:    '#e2e8f0',
  muted:    '#94a3b8',
  dim:      '#475569',
  green:    '#4ade80',
  red:      '#f87171',
  blue:     '#60a5fa',
  yellow:   '#fbbf24',
} as const

// ── Styles ─────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Pages
  pageCover: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.light,
    backgroundColor: C.bg,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.light,
    backgroundColor: C.bg,
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 40,
  },

  // Cover
  coverAccentBar: {
    height: 8,
    backgroundColor: C.orange,
    width: '100%',
  },
  coverBody: {
    flex: 1,
    paddingHorizontal: 48,
    paddingTop: 64,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  coverTop: {},
  coverEyebrow: {
    fontSize: 9,
    color: C.muted,
    letterSpacing: 2,
    marginBottom: 20,
  },
  coverTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 28,
    color: C.orange,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: C.white,
    marginBottom: 6,
  },
  coverProjectNum: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 32,
  },
  coverDivider: {
    height: 2,
    backgroundColor: C.orange,
    width: 60,
    marginBottom: 32,
  },
  coverMeta: {
    fontSize: 9,
    color: C.muted,
    marginBottom: 6,
  },
  coverMetaValue: {
    fontFamily: 'Helvetica-Bold',
    color: C.light,
  },
  coverBottomBar: {
    height: 8,
    backgroundColor: C.surface,
    width: '100%',
  },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: C.orange,
    paddingBottom: 8,
    marginBottom: 18,
  },
  pageHeaderTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: C.orange,
  },
  pageHeaderRight: {
    fontSize: 7.5,
    color: C.dim,
    textAlign: 'right',
  },

  // Section heading
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: C.orange,
    marginBottom: 10,
    marginTop: 4,
  },

  // Metric grid
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    width: '22%',
    backgroundColor: C.surface,
    borderRadius: 4,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.orange,
  },
  metricValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    color: C.orange,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 7.5,
    color: C.muted,
  },

  // Table
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.orange,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  thText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.orange,
    textTransform: 'uppercase',
  },
  tableRowEven: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableRowOdd: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableSummaryRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: C.orange,
  },
  tdText: { fontSize: 7.5, color: C.light },
  tdMono: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#fb923c' },
  tdMuted: { fontSize: 7.5, color: C.muted },
  tdBold: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.light },
  tdGreen: { fontSize: 7.5, color: C.green },
  tdRed: { fontSize: 7.5, color: C.red },
  tdBlue: { fontSize: 7.5, color: C.blue },
  tdYellow: { fontSize: 7.5, color: C.yellow },

  // Empty banner
  emptyBanner: {
    backgroundColor: C.surface,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginVertical: 8,
  },
  emptyText: {
    fontSize: 9,
    color: C.muted,
  },

  // Sign-off
  signOffBox: {
    backgroundColor: C.surface,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: C.orange,
  },
  signOffStatement: {
    fontSize: 9,
    color: C.light,
    lineHeight: 1.6,
    marginBottom: 20,
  },
  signOffGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  signOffCard: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  signOffRole: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.orange,
    marginBottom: 24,
  },
  signOffLine: {
    borderBottomWidth: 0.75,
    borderBottomColor: C.muted,
    marginBottom: 4,
  },
  signOffLineLabel: {
    fontSize: 7,
    color: C.dim,
    marginBottom: 12,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: C.dim,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 4,
  },
})

// ── Data types ─────────────────────────────────────────────────
interface ProjectRow {
  id: string
  name: string
  project_number: string | null
  client_name: string | null
  location: string | null
  status: string
  start_date: string | null
  end_date: string | null
}

interface OrgRow { name: string }

interface WeldRow {
  id: string
  weld_id_number: string
  joint_type: string | null
  pipe_size: string | null
  welder_name: string | null
  status: string
  weld_date: string | null
}

interface ItpRow {
  id: string
  itp_number: string
  title: string
  discipline: string
  status: string
  approved_date: string | null
}

interface NcrRow {
  id: string
  ncr_number: string
  title: string
  status: string
  disposition: string | null
}

interface RfiRow {
  id: string
  rfi_number: string
  title: string
  status: string
  answered_date: string | null
}

interface PressureTestRow {
  id: string
  test_number: string
  system_name: string
  test_pressure: number
  pressure_unit: string
  result: string
  test_date: string | null
}

// ── Helpers ────────────────────────────────────────────────────
function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function cap(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function statusColor(status: string): object {
  const s = status.toLowerCase()
  if (['accepted', 'pass', 'approved', 'answered', 'closed', 'complete'].some(k => s.includes(k))) return S.tdGreen
  if (['failed', 'fail', 'rejected', 'void'].some(k => s.includes(k))) return S.tdRed
  if (['open', 'draft', 'pending'].some(k => s.includes(k))) return S.tdYellow
  return S.tdBlue
}

// ── Page footer element ────────────────────────────────────────
function makeFooter(projectName: string) {
  return React.createElement(View, { style: S.footer, fixed: true },
    React.createElement(T, null, `PipeField OS — ${projectName} — Executive Close-Out Report`),
    React.createElement(T, {
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Page ${pageNumber} of ${totalPages}`,
    }),
  )
}

// ── Page header element ────────────────────────────────────────
function makePageHeader(section: string, projectName: string, dateStr: string) {
  return React.createElement(View, { style: S.pageHeader, fixed: true },
    React.createElement(T, { style: S.pageHeaderTitle }, section),
    React.createElement(View, { style: S.pageHeaderRight },
      React.createElement(T, null, projectName),
      React.createElement(T, null, dateStr),
    ),
  )
}

// ── Cover Page ─────────────────────────────────────────────────
function buildCoverPage(project: ProjectRow, orgName: string, dateStr: string) {
  return React.createElement(Page, { size: 'A4', style: S.pageCover },
    React.createElement(View, { style: S.coverAccentBar }),
    React.createElement(View, { style: S.coverBody },
      React.createElement(View, { style: S.coverTop },
        React.createElement(T, { style: S.coverEyebrow }, 'PIPEFIELD OS  ·  QUALITY MANAGEMENT'),
        React.createElement(T, { style: S.coverTitle }, 'PROJECT CLOSE-OUT REPORT'),
        React.createElement(View, { style: S.coverDivider }),
        React.createElement(T, { style: S.coverSubtitle }, project.name),
        project.project_number
          ? React.createElement(T, { style: S.coverProjectNum }, `Project No. ${project.project_number}`)
          : null,
        React.createElement(T, { style: S.coverMeta },
          'Organisation: ',
          React.createElement(T, { style: S.coverMetaValue }, orgName),
        ),
        project.client_name
          ? React.createElement(T, { style: S.coverMeta },
              'Client: ',
              React.createElement(T, { style: S.coverMetaValue }, project.client_name),
            )
          : null,
        project.location
          ? React.createElement(T, { style: S.coverMeta },
              'Location: ',
              React.createElement(T, { style: S.coverMetaValue }, project.location),
            )
          : null,
        React.createElement(T, { style: S.coverMeta },
          'Project Status: ',
          React.createElement(T, { style: S.coverMetaValue }, cap(project.status)),
        ),
        React.createElement(T, { style: { ...S.coverMeta, marginTop: 24 } },
          'Report Generated: ',
          React.createElement(T, { style: S.coverMetaValue }, dateStr),
        ),
      ),
      React.createElement(View, null,
        React.createElement(T, { style: { fontSize: 7, color: C.dim } },
          'This document is confidential and intended solely for the authorised recipients named herein.',
        ),
      ),
    ),
    React.createElement(View, { style: S.coverBottomBar }),
  )
}

// ── Executive Summary Page ─────────────────────────────────────
function buildSummaryPage(
  project: ProjectRow,
  welds: WeldRow[],
  itps: ItpRow[],
  pressureTests: PressureTestRow[],
  dateStr: string,
) {
  const totalWelds = welds.length
  const accepted   = welds.filter(w => w.status === 'accepted').length
  const accRate    = totalWelds > 0 ? `${Math.round((accepted / totalWelds) * 100)}%` : 'N/A'
  const itpsDone   = itps.filter(i => i.status === 'approved').length
  const ptPassed   = pressureTests.filter(p => p.result === 'pass').length

  const metrics = [
    { label: 'Total Welds',        value: String(totalWelds) },
    { label: 'Acceptance Rate',    value: accRate            },
    { label: 'ITPs Approved',      value: String(itpsDone)   },
    { label: 'Pressure Tests\nPassed', value: String(ptPassed) },
  ]

  return React.createElement(Page, { size: 'A4', style: S.page },
    makePageHeader('EXECUTIVE SUMMARY', project.name, dateStr),

    React.createElement(T, { style: S.sectionTitle }, 'Key Performance Metrics'),
    React.createElement(View, { style: S.metricGrid },
      ...metrics.map((m, i) =>
        React.createElement(View, { style: S.metricCard, key: i },
          React.createElement(T, { style: S.metricValue }, m.value),
          React.createElement(T, { style: S.metricLabel }, m.label),
        )
      )
    ),

    React.createElement(T, { style: S.sectionTitle }, 'Project Overview'),
    React.createElement(View, { style: { ...S.signOffBox, borderLeftColor: C.blue } },
      ...[
        ['Project Name',   project.name],
        ['Project Number', project.project_number ?? '—'],
        ['Client',         project.client_name ?? '—'],
        ['Location',       project.location ?? '—'],
        ['Status',         cap(project.status)],
        ['Start Date',     fmt(project.start_date)],
        ['End Date',       fmt(project.end_date)],
      ].map(([label, value], i) =>
        React.createElement(View, {
          key: i,
          style: {
            flexDirection: 'row',
            paddingVertical: 4,
            borderBottomWidth: 0.5,
            borderBottomColor: C.border,
          },
        },
          React.createElement(T, { style: { ...S.tdMuted, width: 120 } }, label),
          React.createElement(T, { style: S.tdText }, value),
        )
      )
    ),

    makeFooter(project.name),
  )
}

// ── Weld Register Page ─────────────────────────────────────────
function buildWeldPage(project: ProjectRow, welds: WeldRow[], dateStr: string) {
  const colW  = { width: 65 }
  const colJT = { width: 80 }
  const colSz = { width: 50 }
  const colWl = { width: 100 }
  const colSt = { width: 75 }
  const colDt = { width: 70 }

  const accepted = welds.filter(w => w.status === 'accepted').length
  const failed   = welds.filter(w => w.status === 'failed').length

  const headerRow = React.createElement(View, { style: S.tableHead },
    React.createElement(View, { style: colW  }, React.createElement(T, { style: S.thText }, 'Weld #')),
    React.createElement(View, { style: colJT }, React.createElement(T, { style: S.thText }, 'Joint Type')),
    React.createElement(View, { style: colSz }, React.createElement(T, { style: S.thText }, 'Size')),
    React.createElement(View, { style: colWl }, React.createElement(T, { style: S.thText }, 'Welder')),
    React.createElement(View, { style: colSt }, React.createElement(T, { style: S.thText }, 'Status')),
    React.createElement(View, { style: colDt }, React.createElement(T, { style: S.thText }, 'Date')),
  )

  const dataRows = welds.map((w, idx) =>
    React.createElement(View, { style: idx % 2 === 0 ? S.tableRowEven : S.tableRowOdd, key: w.id },
      React.createElement(View, { style: colW  }, React.createElement(T, { style: S.tdMono  }, w.weld_id_number)),
      React.createElement(View, { style: colJT }, React.createElement(T, { style: S.tdMuted }, w.joint_type ?? '—')),
      React.createElement(View, { style: colSz }, React.createElement(T, { style: S.tdMuted }, w.pipe_size ?? '—')),
      React.createElement(View, { style: colWl }, React.createElement(T, { style: S.tdText  }, w.welder_name ?? '—')),
      React.createElement(View, { style: colSt }, React.createElement(T, { style: statusColor(w.status) }, cap(w.status))),
      React.createElement(View, { style: colDt }, React.createElement(T, { style: S.tdMuted }, fmt(w.weld_date))),
    )
  )

  const summaryRow = React.createElement(View, { style: S.tableSummaryRow },
    React.createElement(View, { style: colW  }, React.createElement(T, { style: S.tdBold }, 'TOTAL')),
    React.createElement(View, { style: colJT }, React.createElement(T, { style: S.tdBold }, `${welds.length} welds`)),
    React.createElement(View, { style: colSz }, React.createElement(T, { style: S.tdText }, '')),
    React.createElement(View, { style: colWl }, React.createElement(T, { style: S.tdText }, '')),
    React.createElement(View, { style: colSt }, React.createElement(T, { style: S.tdGreen }, `${accepted} accepted / ${failed} failed`)),
    React.createElement(View, { style: colDt }, React.createElement(T, { style: S.tdText }, '')),
  )

  return React.createElement(Page, { size: 'A4', style: S.page },
    makePageHeader('WELD REGISTER', project.name, dateStr),
    welds.length === 0
      ? React.createElement(View, { style: S.emptyBanner },
          React.createElement(T, { style: S.emptyText }, 'No weld records found for this project.'),
        )
      : React.createElement(View, null,
          headerRow,
          ...dataRows,
          summaryRow,
        ),
    makeFooter(project.name),
  )
}

// ── ITP Summary Page ───────────────────────────────────────────
function buildItpPage(project: ProjectRow, itps: ItpRow[], dateStr: string) {
  const colNum  = { width: 70 }
  const colTitle = { width: 150 }
  const colDisc  = { width: 90 }
  const colSt    = { width: 80 }
  const colDt    = { width: 80 }

  const headerRow = React.createElement(View, { style: S.tableHead },
    React.createElement(View, { style: colNum   }, React.createElement(T, { style: S.thText }, 'ITP #')),
    React.createElement(View, { style: colTitle }, React.createElement(T, { style: S.thText }, 'Title')),
    React.createElement(View, { style: colDisc  }, React.createElement(T, { style: S.thText }, 'Discipline')),
    React.createElement(View, { style: colSt    }, React.createElement(T, { style: S.thText }, 'Status')),
    React.createElement(View, { style: colDt    }, React.createElement(T, { style: S.thText }, 'Approved Date')),
  )

  const dataRows = itps.map((itp, idx) =>
    React.createElement(View, { style: idx % 2 === 0 ? S.tableRowEven : S.tableRowOdd, key: itp.id },
      React.createElement(View, { style: colNum   }, React.createElement(T, { style: S.tdMono  }, itp.itp_number)),
      React.createElement(View, { style: colTitle }, React.createElement(T, { style: S.tdText  }, itp.title)),
      React.createElement(View, { style: colDisc  }, React.createElement(T, { style: S.tdMuted }, cap(itp.discipline))),
      React.createElement(View, { style: colSt    }, React.createElement(T, { style: statusColor(itp.status) }, cap(itp.status))),
      React.createElement(View, { style: colDt    }, React.createElement(T, { style: S.tdMuted }, fmt(itp.approved_date))),
    )
  )

  return React.createElement(Page, { size: 'A4', style: S.page },
    makePageHeader('ITP SUMMARY', project.name, dateStr),
    itps.length === 0
      ? React.createElement(View, { style: S.emptyBanner },
          React.createElement(T, { style: S.emptyText }, 'No ITP records found for this project.'),
        )
      : React.createElement(View, null, headerRow, ...dataRows),
    makeFooter(project.name),
  )
}

// ── NCR Log Page ───────────────────────────────────────────────
function buildNcrPage(project: ProjectRow, ncrs: NcrRow[], dateStr: string) {
  const colNum  = { width: 65 }
  const colDesc = { width: 190 }
  const colSt   = { width: 80 }
  const colRes  = { width: 120 }

  const headerRow = React.createElement(View, { style: S.tableHead },
    React.createElement(View, { style: colNum  }, React.createElement(T, { style: S.thText }, 'NCR #')),
    React.createElement(View, { style: colDesc }, React.createElement(T, { style: S.thText }, 'Description')),
    React.createElement(View, { style: colSt   }, React.createElement(T, { style: S.thText }, 'Status')),
    React.createElement(View, { style: colRes  }, React.createElement(T, { style: S.thText }, 'Resolution')),
  )

  const dataRows = ncrs.map((ncr, idx) =>
    React.createElement(View, { style: idx % 2 === 0 ? S.tableRowEven : S.tableRowOdd, key: ncr.id },
      React.createElement(View, { style: colNum  }, React.createElement(T, { style: S.tdMono  }, ncr.ncr_number)),
      React.createElement(View, { style: colDesc }, React.createElement(T, { style: S.tdText  }, ncr.title)),
      React.createElement(View, { style: colSt   }, React.createElement(T, { style: statusColor(ncr.status) }, cap(ncr.status))),
      React.createElement(View, { style: colRes  }, React.createElement(T, { style: S.tdMuted }, ncr.disposition ? cap(ncr.disposition) : '—')),
    )
  )

  return React.createElement(Page, { size: 'A4', style: S.page },
    makePageHeader('NCR LOG', project.name, dateStr),
    ncrs.length === 0
      ? React.createElement(View, { style: S.emptyBanner },
          React.createElement(T, { style: S.emptyText }, 'No Non-Conformance Reports raised on this project.'),
        )
      : React.createElement(View, null, headerRow, ...dataRows),
    makeFooter(project.name),
  )
}

// ── RFI Log Page ───────────────────────────────────────────────
function buildRfiPage(project: ProjectRow, rfis: RfiRow[], dateStr: string) {
  const colNum  = { width: 65 }
  const colSubj = { width: 215 }
  const colSt   = { width: 75 }
  const colDt   = { width: 90 }

  const headerRow = React.createElement(View, { style: S.tableHead },
    React.createElement(View, { style: colNum  }, React.createElement(T, { style: S.thText }, 'RFI #')),
    React.createElement(View, { style: colSubj }, React.createElement(T, { style: S.thText }, 'Subject')),
    React.createElement(View, { style: colSt   }, React.createElement(T, { style: S.thText }, 'Status')),
    React.createElement(View, { style: colDt   }, React.createElement(T, { style: S.thText }, 'Response Date')),
  )

  const dataRows = rfis.map((rfi, idx) =>
    React.createElement(View, { style: idx % 2 === 0 ? S.tableRowEven : S.tableRowOdd, key: rfi.id },
      React.createElement(View, { style: colNum  }, React.createElement(T, { style: S.tdMono  }, rfi.rfi_number)),
      React.createElement(View, { style: colSubj }, React.createElement(T, { style: S.tdText  }, rfi.title)),
      React.createElement(View, { style: colSt   }, React.createElement(T, { style: statusColor(rfi.status) }, cap(rfi.status))),
      React.createElement(View, { style: colDt   }, React.createElement(T, { style: S.tdMuted }, fmt(rfi.answered_date))),
    )
  )

  return React.createElement(Page, { size: 'A4', style: S.page },
    makePageHeader('RFI LOG', project.name, dateStr),
    rfis.length === 0
      ? React.createElement(View, { style: S.emptyBanner },
          React.createElement(T, { style: S.emptyText }, 'No RFIs raised on this project.'),
        )
      : React.createElement(View, null, headerRow, ...dataRows),
    makeFooter(project.name),
  )
}

// ── Pressure Tests Page ────────────────────────────────────────
function buildPressureTestPage(project: ProjectRow, tests: PressureTestRow[], dateStr: string) {
  const colNum  = { width: 60 }
  const colSys  = { width: 140 }
  const colPres = { width: 90 }
  const colRes  = { width: 75 }
  const colDt   = { width: 80 }

  const headerRow = React.createElement(View, { style: S.tableHead },
    React.createElement(View, { style: colNum  }, React.createElement(T, { style: S.thText }, 'Test #')),
    React.createElement(View, { style: colSys  }, React.createElement(T, { style: S.thText }, 'System')),
    React.createElement(View, { style: colPres }, React.createElement(T, { style: S.thText }, 'Test Pressure')),
    React.createElement(View, { style: colRes  }, React.createElement(T, { style: S.thText }, 'Result')),
    React.createElement(View, { style: colDt   }, React.createElement(T, { style: S.thText }, 'Test Date')),
  )

  const dataRows = tests.map((t, idx) =>
    React.createElement(View, { style: idx % 2 === 0 ? S.tableRowEven : S.tableRowOdd, key: t.id },
      React.createElement(View, { style: colNum  }, React.createElement(T, { style: S.tdMono  }, t.test_number)),
      React.createElement(View, { style: colSys  }, React.createElement(T, { style: S.tdText  }, t.system_name)),
      React.createElement(View, { style: colPres }, React.createElement(T, { style: S.tdMuted }, `${t.test_pressure} ${t.pressure_unit}`)),
      React.createElement(View, { style: colRes  }, React.createElement(T, { style: statusColor(t.result) }, cap(t.result))),
      React.createElement(View, { style: colDt   }, React.createElement(T, { style: S.tdMuted }, fmt(t.test_date))),
    )
  )

  return React.createElement(Page, { size: 'A4', style: S.page },
    makePageHeader('PRESSURE TESTS', project.name, dateStr),
    tests.length === 0
      ? React.createElement(View, { style: S.emptyBanner },
          React.createElement(T, { style: S.emptyText }, 'No pressure tests recorded for this project.'),
        )
      : React.createElement(View, null, headerRow, ...dataRows),
    makeFooter(project.name),
  )
}

// ── Sign-Off Page ──────────────────────────────────────────────
function buildSignOffPage(project: ProjectRow, dateStr: string) {
  const roles = ['QC Manager', 'Project Manager', 'Client Representative']

  return React.createElement(Page, { size: 'A4', style: S.page },
    makePageHeader('SIGN-OFF & CERTIFICATION', project.name, dateStr),

    React.createElement(T, { style: S.sectionTitle }, 'Project Completion Certification'),
    React.createElement(View, { style: S.signOffBox },
      React.createElement(T, { style: S.signOffStatement },
        `We, the undersigned, hereby certify that the work described in this close-out report for ` +
        `the project "${project.name}"` +
        (project.project_number ? ` (Project No. ${project.project_number})` : '') +
        ` has been completed in accordance with the applicable codes, standards, specifications, and ` +
        `contractual requirements. All quality records referenced herein are accurate and complete ` +
        `to the best of our knowledge. This report was generated on ${dateStr} using PipeField OS.`,
      ),

      React.createElement(View, { style: S.signOffGrid },
        ...roles.map((role, i) =>
          React.createElement(View, { style: S.signOffCard, key: i },
            React.createElement(T, { style: S.signOffRole }, role.toUpperCase()),
            React.createElement(View, { style: { marginBottom: 28 } }),
            React.createElement(View, { style: S.signOffLine }),
            React.createElement(T, { style: S.signOffLineLabel }, 'Signature'),
            React.createElement(View, { style: S.signOffLine }),
            React.createElement(T, { style: S.signOffLineLabel }, 'Name (Print)'),
            React.createElement(View, { style: S.signOffLine }),
            React.createElement(T, { style: S.signOffLineLabel }, 'Date'),
          )
        )
      ),
    ),

    makeFooter(project.name),
  )
}

// ── Main PDF builder ───────────────────────────────────────────
function buildPdf(
  project: ProjectRow,
  org: OrgRow,
  welds: WeldRow[],
  itps: ItpRow[],
  ncrs: NcrRow[],
  rfis: RfiRow[],
  pressureTests: PressureTestRow[],
  dateStr: string,
) {
  return React.createElement(
    Document,
    { title: `Close-Out Report — ${project.name}`, author: 'PipeField OS' },
    buildCoverPage(project, org.name, dateStr),
    buildSummaryPage(project, welds, itps, pressureTests, dateStr),
    buildWeldPage(project, welds, dateStr),
    buildItpPage(project, itps, dateStr),
    buildNcrPage(project, ncrs, dateStr),
    buildRfiPage(project, rfis, dateStr),
    buildPressureTestPage(project, pressureTests, dateStr),
    buildSignOffPage(project, dateStr),
  )
}

// ── Route handler ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
    }

    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // ── Parallel fetch ──────────────────────────────────────────
    const [
      projectRes,
      orgRes,
      weldsRes,
      itpsRes,
      ncrsRes,
      rfisRes,
      pressureTestsRes,
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, project_number, client_name, location, status, start_date, end_date')
        .eq('id', projectId)
        .eq('organization_id', caller.organization_id)
        .maybeSingle(),

      supabase
        .from('organizations')
        .select('name')
        .eq('id', caller.organization_id)
        .maybeSingle(),

      supabase
        .from('welds')
        .select('id, weld_id_number, joint_type, pipe_size, welder_name, status, weld_date')
        .eq('project_id', projectId)
        .eq('organization_id', caller.organization_id)
        .order('weld_id_number'),

      supabase
        .from('itps')
        .select('id, itp_number, title, discipline, status, approved_date')
        .eq('project_id', projectId)
        .eq('organization_id', caller.organization_id)
        .order('itp_number'),

      supabase
        .from('ncrs')
        .select('id, ncr_number, title, status, disposition')
        .eq('project_id', projectId)
        .eq('organization_id', caller.organization_id)
        .order('ncr_number'),

      supabase
        .from('rfis')
        .select('id, rfi_number, title, status, answered_date')
        .eq('project_id', projectId)
        .eq('organization_id', caller.organization_id)
        .order('rfi_number'),

      supabase
        .from('pressure_tests')
        .select('id, test_number, system_name, test_pressure, pressure_unit, result, test_date')
        .eq('project_id', projectId)
        .eq('organization_id', caller.organization_id)
        .order('test_number'),
    ])

    // ── Guard project existence / org scope ─────────────────────
    if (!projectRes.data) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    const project      = projectRes.data as ProjectRow
    const org: OrgRow  = { name: (orgRes.data as { name?: string } | null)?.name ?? 'PipeField OS' }
    const welds        = (weldsRes.data        ?? []) as WeldRow[]
    const itps         = (itpsRes.data         ?? []) as ItpRow[]
    const ncrs         = (ncrsRes.data         ?? []) as NcrRow[]
    const rfis         = (rfisRes.data         ?? []) as RfiRow[]
    const pressureTests = (pressureTestsRes.data ?? []) as PressureTestRow[]

    const dateStr = new Date().toLocaleDateString('en-AU', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    const doc    = buildPdf(project, org, welds, itps, ncrs, rfis, pressureTests, dateStr)
    const buffer = await renderToBuffer(doc)

    const fileDate = new Date().toISOString().split('T')[0]
    const slug     = project.project_number
      ? project.project_number.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      : projectId.slice(0, 8)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="close-out-report-${slug}-${fileDate}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Executive report PDF error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 },
    )
  }
}

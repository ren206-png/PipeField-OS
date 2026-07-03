// ============================================================
// GET /api/reports/itp-certificate?id=<itp_id>
// Returns a PDF completion certificate for a fully-completed ITP.
// Uses React.createElement — no JSX (server route).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'

// ── Styles ────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily:       'Helvetica',
    fontSize:         9,
    color:            '#1e293b',
    backgroundColor:  '#ffffff',
    paddingTop:       48,
    paddingBottom:    64,
    paddingHorizontal: 48,
  },

  // ── Header ──
  header: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
    paddingBottom:     14,
    marginBottom:      18,
  },
  headerLeft: { flex: 1 },
  headerOrgName: {
    fontFamily: 'Helvetica-Bold',
    fontSize:   13,
    color:      '#1e293b',
    marginBottom: 2,
  },
  headerRight: { textAlign: 'right' },
  headerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize:   12,
    color:      '#1e40af',
  },
  headerSubtitle: {
    fontSize:  8,
    color:     '#64748b',
    marginTop: 2,
  },
  headerCertNo: {
    fontFamily: 'Helvetica-Bold',
    fontSize:   9,
    color:      '#1e293b',
    marginTop:  4,
  },

  // ── Completion Banner ──
  completionBanner: {
    backgroundColor:  '#dcfce7',
    borderWidth:       1,
    borderColor:       '#059669',
    borderRadius:      4,
    padding:           12,
    alignItems:        'center',
    marginBottom:      16,
  },
  completionBannerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize:   18,
    color:      '#059669',
    letterSpacing: 2,
  },
  completionBannerSub: {
    fontSize:   9,
    color:      '#16a34a',
    marginTop:  3,
  },

  // ── Section ──
  sectionWrap: { marginBottom: 12 },
  sectionTitle: {
    fontFamily:      'Helvetica-Bold',
    fontSize:        8,
    color:           '#1e40af',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    paddingBottom:   3,
    marginBottom:    6,
    textTransform:   'uppercase',
    letterSpacing:   0.5,
  },

  // ── KV row ──
  row: {
    flexDirection:    'row',
    paddingVertical:  2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  label: { color: '#64748b', width: '38%' },
  value: { fontFamily: 'Helvetica-Bold', width: '62%' },

  // ── Table ──
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#93c5fd',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection:    'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical:  3,
    paddingHorizontal: 4,
    minHeight:         18,
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  thText: {
    fontFamily:  'Helvetica-Bold',
    fontSize:    7,
    color:       '#1e40af',
    textTransform: 'uppercase',
  },
  tdText: { fontSize: 7.5, color: '#1e293b' },
  tdSmall: { fontSize: 6.5, color: '#64748b' },

  colNo:     { width: '6%' },
  colActivity: { width: '30%' },
  colLevel:  { width: '16%' },
  colResult: { width: '10%' },
  colBy:     { width: '20%' },
  colDate:   { width: '18%' },

  // ── Signature ──
  signatureSection: { marginTop: 8 },
  certText: {
    fontSize:   8,
    color:      '#475569',
    lineHeight: 1.6,
    fontStyle:  'italic',
    marginBottom: 12,
  },
  signatureRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  signatureBlock: { flex: 1, marginRight: 16 },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    marginBottom:      3,
    height:            20,
  },
  signatureLabel: { fontSize: 7, color: '#94a3b8' },

  // ── Footer ──
  footer: {
    position:       'absolute',
    bottom:         24,
    left:           48,
    right:          48,
    flexDirection:  'row',
    justifyContent: 'space-between',
    fontSize:       7,
    color:          '#94a3b8',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop:     4,
  },
})

// ── Types ─────────────────────────────────────────────────────

interface ItpItemRow {
  id:               string
  item_number:      string
  activity:         string
  inspector_level:  string
  client_level:     string
  status:           string
  completed_date:   string | null
  completed_by:     string | null
}

interface ItpRow {
  id:              string
  itp_number:      string
  title:           string
  description:     string | null
  discipline:      string
  completed_at:    string | null
  approved_by:     string | null
  approved_date:   string | null
  organization_id: string
  project:         { name: string; project_number: string } | null
  itp_items:       ItpItemRow[]
}

// ── Helpers ───────────────────────────────────────────────────

function kvRow(label: string, value: string, key: string): React.ReactElement {
  return React.createElement(View, { style: S.row, key },
    React.createElement(Text, { style: S.label }, label),
    React.createElement(Text, { style: S.value }, value),
  )
}

function section(title: string, key: string, ...children: React.ReactElement[]): React.ReactElement {
  return React.createElement(View, { style: S.sectionWrap, key },
    React.createElement(Text, { style: S.sectionTitle }, title),
    ...children,
  )
}

function levelLabel(level: string): string {
  const map: Record<string, string> = {
    hold: 'H — Hold', witness: 'W — Witness', review: 'R — Review',
    monitor: 'M — Monitor', perform: 'P — Perform', n_a: 'N/A',
  }
  return map[level] ?? level
}

// ── PDF Builder ───────────────────────────────────────────────

function buildPdf(itp: ItpRow, orgName: string): React.ReactElement {
  const now            = new Date().toLocaleDateString('en-CA')
  const completedDate  = itp.completed_at
    ? new Date(itp.completed_at).toLocaleDateString('en-CA')
    : now

  const children: React.ReactElement[] = []

  // ── Header ──
  children.push(
    React.createElement(View, { style: S.header, key: 'header' },
      React.createElement(View, { style: S.headerLeft, key: 'hl' },
        React.createElement(Text, { style: S.headerOrgName }, orgName),
      ),
      React.createElement(View, { style: S.headerRight, key: 'hr' },
        React.createElement(Text, { style: S.headerTitle }, 'INSPECTION & TEST PLAN'),
        React.createElement(Text, { style: S.headerTitle }, 'COMPLETION CERTIFICATE'),
        React.createElement(Text, { style: S.headerSubtitle }, 'Quality Management System'),
        React.createElement(Text, { style: S.headerCertNo }, `ITP No: ${itp.itp_number}`),
      ),
    ),
  )

  // ── Completion Banner ──
  children.push(
    React.createElement(View, { style: S.completionBanner, key: 'banner' },
      React.createElement(Text, { style: S.completionBannerTitle }, '✓  ALL INSPECTIONS COMPLETE'),
      React.createElement(Text, { style: S.completionBannerSub },
        `Completion Date: ${completedDate}`,
      ),
    ),
  )

  // ── Project & ITP Info ──
  children.push(section('Project Information', 'proj-info',
    kvRow('Organization',   orgName, 'r-org'),
    kvRow('Project',        itp.project?.name ?? 'N/A', 'r-proj'),
    kvRow('Project No.',    itp.project?.project_number ?? 'N/A', 'r-projno'),
    kvRow('ITP Number',     itp.itp_number, 'r-itpno'),
    kvRow('ITP Title',      itp.title, 'r-title'),
    kvRow('Discipline',     itp.discipline.charAt(0).toUpperCase() + itp.discipline.slice(1), 'r-disc'),
    ...(itp.description ? [kvRow('Description', itp.description, 'r-desc')] : []),
    kvRow('Date Completed', completedDate, 'r-comp'),
    ...(itp.approved_by
      ? [kvRow('Approved By', `${itp.approved_by}${itp.approved_date ? ' · ' + itp.approved_date : ''}`, 'r-approv')]
      : []),
  ))

  // ── Inspection Items Table ──
  const tableHeaderEl = React.createElement(View, { style: S.tableHeader, key: 'th' },
    React.createElement(Text, { style: { ...S.thText, ...S.colNo } }, '#'),
    React.createElement(Text, { style: { ...S.thText, ...S.colActivity } }, 'Activity'),
    React.createElement(Text, { style: { ...S.thText, ...S.colLevel } }, 'Hold/Witness/Review'),
    React.createElement(Text, { style: { ...S.thText, ...S.colResult } }, 'Result'),
    React.createElement(Text, { style: { ...S.thText, ...S.colBy } }, 'Inspector'),
    React.createElement(Text, { style: { ...S.thText, ...S.colDate } }, 'Date'),
  )

  const tableRows = itp.itp_items.map((item, idx) => {
    const isAlt = idx % 2 === 1
    const rowStyle = isAlt
      ? { ...S.tableRow, ...S.tableRowAlt }
      : S.tableRow
    const resultMap: Record<string, string> = {
      complete:       'PASS',
      not_applicable: 'N/A',
      pending:        '—',
      in_progress:    'In Prog.',
    }
    return React.createElement(View, { style: rowStyle, key: item.id, wrap: false },
      React.createElement(Text, { style: { ...S.tdText, ...S.colNo } }, item.item_number),
      React.createElement(Text, { style: { ...S.tdText, ...S.colActivity } }, item.activity),
      React.createElement(Text, { style: { ...S.tdSmall, ...S.colLevel } },
        `INS: ${levelLabel(item.inspector_level)}\nCLT: ${levelLabel(item.client_level)}`,
      ),
      React.createElement(Text, { style: { ...S.tdText, ...S.colResult } },
        resultMap[item.status] ?? item.status,
      ),
      React.createElement(Text, { style: { ...S.tdSmall, ...S.colBy } }, item.completed_by ?? ''),
      React.createElement(Text, { style: { ...S.tdSmall, ...S.colDate } }, item.completed_date ?? ''),
    )
  })

  children.push(section('Inspection Activities', 'items-section',
    tableHeaderEl,
    ...tableRows,
  ))

  // ── QC Manager Sign-off ──
  children.push(
    React.createElement(View, { style: S.signatureSection, key: 'sign-section' },
      React.createElement(Text, { style: S.sectionTitle }, 'Quality Manager Sign-Off'),
      React.createElement(Text, { style: S.certText },
        'I certify that all inspection activities listed in this Inspection & Test Plan have been carried out ' +
        'in accordance with the applicable codes, standards, and project specifications, and that all records ' +
        'are true and accurate to the best of my knowledge.',
      ),
      React.createElement(View, { style: S.signatureRow, key: 'sig-r1' },
        React.createElement(View, { style: S.signatureBlock, key: 'sb1' },
          React.createElement(View, { style: S.signatureLine }),
          React.createElement(Text, { style: S.signatureLabel }, 'QC Manager — Print Name'),
        ),
        React.createElement(View, { style: { ...S.signatureBlock, marginRight: 0 }, key: 'sb2' },
          React.createElement(View, { style: S.signatureLine }),
          React.createElement(Text, { style: S.signatureLabel }, 'Signature'),
        ),
      ),
      React.createElement(View, { style: S.signatureRow, key: 'sig-r2' },
        React.createElement(View, { style: S.signatureBlock, key: 'sb3' },
          React.createElement(View, { style: S.signatureLine }),
          React.createElement(Text, { style: S.signatureLabel }, 'Title / Position'),
        ),
        React.createElement(View, { style: { ...S.signatureBlock, marginRight: 0 }, key: 'sb4' },
          React.createElement(View, { style: S.signatureLine }),
          React.createElement(Text, { style: S.signatureLabel }, 'Date'),
        ),
      ),
    ),
  )

  // ── Footer ──
  children.push(
    React.createElement(View, { style: S.footer, fixed: true, key: 'footer' },
      React.createElement(Text, {}, `${orgName}  •  Generated by PipeField OS  •  ${now}`),
      React.createElement(Text, {
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`,
      }),
    ),
  )

  return React.createElement(
    Document,
    { title: `ITP Completion Certificate — ${itp.itp_number}` },
    React.createElement(Page, { size: 'A4', style: S.page }, ...children),
  )
}

// ── Route Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth()
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const orgId = caller.organization_id

    // Fetch ITP with items (scoped to org for security)
    const { data: itp, error: itpError } = await admin
      .from('itps')
      .select('*, project:projects(name, project_number), itp_items(*)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (itpError) {
      console.error('ITP fetch error:', itpError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!itp) {
      return NextResponse.json({ error: 'ITP not found' }, { status: 404 })
    }

    // Fetch org name
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()

    const orgName = org?.name ?? 'Organization'

    // Sort items by sort_order
    const sortedItems = ((itp.itp_items as ItpItemRow[]) ?? [])
      .sort((a, b) => {
        const aNum = parseFloat(a.item_number) || 0
        const bNum = parseFloat(b.item_number) || 0
        return aNum - bNum
      })

    const doc    = buildPdf({ ...itp, itp_items: sortedItems } as ItpRow, orgName)
    const buffer = await renderToBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="itp-certificate-${itp.itp_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error('ITP certificate PDF error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 },
    )
  }
}

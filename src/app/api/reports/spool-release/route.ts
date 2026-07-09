// POST /api/reports/spool-release
// Body: { spoolId: string }
// Returns a PDF spool release certificate.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'

// ── Styles ─────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    paddingTop: 0,
    paddingBottom: 60,
    paddingHorizontal: 0,
  },
  // Header banner
  headerBanner: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 48,
    paddingTop: 32,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerOrgName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtext: {
    fontSize: 8,
    color: '#94a3b8',
  },
  headerRight: {
    textAlign: 'right',
  },
  headerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: '#f97316',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerCertNo: {
    fontSize: 8,
    color: '#cbd5e1',
    fontFamily: 'Helvetica-Bold',
  },
  // Body padding wrapper
  body: {
    paddingHorizontal: 48,
  },
  // Section
  sectionWrap: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#f97316',
    borderBottomWidth: 1.5,
    borderBottomColor: '#f97316',
    paddingBottom: 3,
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // Row
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  label: {
    color: '#64748b',
    width: '40%',
  },
  value: {
    fontFamily: 'Helvetica-Bold',
    width: '60%',
    color: '#1e293b',
  },
  // Two-column grid
  grid2: {
    flexDirection: 'row',
    gap: 16,
  },
  grid2Col: {
    flex: 1,
  },
  // Status released box
  releasedBox: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  releasedText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#059669',
    letterSpacing: 1,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowAlt: {
    backgroundColor: '#f1f5f9',
  },
  tableCell: {
    fontSize: 8,
    color: '#334155',
  },
  // Weld summary line
  weldSummary: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
  },
  weldSummaryItem: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#0f172a',
  },
  // Cert statement
  certText: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.6,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  // Sign-off
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 20,
  },
  signatureBlock: {
    flex: 1,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    marginBottom: 3,
    height: 18,
  },
  signatureLabel: {
    fontSize: 7.5,
    color: '#94a3b8',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
  },
  noItems: {
    fontSize: 8,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
})

// ── Types ──────────────────────────────────────────────────────

interface SpoolWeld {
  weld_id_number: string
  status:         string
  welder_stamp:   string | null
  welder_name:    string | null
  weld_date:      string | null
}

interface SpoolItemRow {
  item_type:   string
  description: string
  quantity:    number
  length_in:   number | null
  heat_number: string | null
}

interface SpoolData {
  id:              string
  spool_number:    string
  line_number:     string | null
  status:          string
  pipe_size:       string | null
  pipe_schedule:   string | null
  material:        string | null
  service:         string | null
  design_pressure: number | null
  design_temp:     number | null
  isometric_ref:   string | null
  area:            string | null
  notes:           string | null
  released_date:   string | null
  project:         { name: string; project_number: string } | null
  spool_items:     SpoolItemRow[]
  welds:           SpoolWeld[]
}

// ── Helpers ────────────────────────────────────────────────────

function infoRow(label: string, value: string, key: string) {
  return React.createElement(View, { style: S.row, key },
    React.createElement(Text, { style: S.label }, label),
    React.createElement(Text, { style: S.value }, value || '—'),
  )
}

function section(title: string, key: string, ...children: React.ReactElement[]) {
  return React.createElement(View, { style: S.sectionWrap, key },
    React.createElement(Text, { style: S.sectionTitle }, title),
    ...children,
  )
}

// ── PDF Builder ────────────────────────────────────────────────

function buildPdf(spool: SpoolData, orgName: string): React.ReactElement {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-CA')
  const dateCompact = dateStr.replace(/-/g, '')
  const certNo = `SR-${spool.spool_number}-${dateCompact}`

  const children: React.ReactElement[] = []

  // ── Header Banner ──
  children.push(
    React.createElement(View, { style: S.headerBanner, key: 'header' },
      React.createElement(View, { style: S.headerLeft, key: 'hl' },
        React.createElement(Text, { style: S.headerOrgName }, orgName),
        React.createElement(Text, { style: S.headerSubtext }, 'Piping Fabrication Management'),
      ),
      React.createElement(View, { style: S.headerRight, key: 'hr' },
        React.createElement(Text, { style: S.headerTitle }, 'SPOOL RELEASE CERTIFICATE'),
        React.createElement(Text, { style: S.headerCertNo }, `Certificate No: ${certNo}`),
      ),
    )
  )

  // ── Body wrapper open ──
  const bodyChildren: React.ReactElement[] = []

  // ── Section 1: Spool Information ──
  bodyChildren.push(section('1. Spool Information', 'sec1',
    React.createElement(View, { style: S.grid2, key: 'info-grid' },
      React.createElement(View, { style: S.grid2Col, key: 'ic1' },
        infoRow('Spool Number',   spool.spool_number,                        'sn'),
        infoRow('Line Number',    spool.line_number ?? '',                   'ln'),
        infoRow('Project Name',   spool.project?.name ?? '',                 'pn'),
        infoRow('Project Number', spool.project?.project_number ?? '',       'pno'),
      ),
      React.createElement(View, { style: S.grid2Col, key: 'ic2' },
        infoRow('Material / Spec',  spool.material ?? '',        'mat'),
        infoRow('Size',             spool.pipe_size ?? '',        'sz'),
        infoRow('Wall Thickness',   spool.pipe_schedule ?? '',    'wt'),
        infoRow('Area / Location',  spool.area ?? '',             'area'),
      ),
    ),
    React.createElement(View, { style: S.releasedBox, key: 'rbox' },
      React.createElement(Text, { style: S.releasedText }, '✓ RELEASED'),
    ),
  ))

  // ── Section 2: Weld Summary ──
  const welds = spool.welds ?? []
  const totalWelds    = welds.length
  const acceptedWelds = welds.filter(w =>
    ['visual_pass', 'accepted', 'xray_pass', 'passed', 'complete'].includes(w.status)
  ).length
  const passRate = totalWelds > 0 ? Math.round((acceptedWelds / totalWelds) * 100) : 0

  const weldTableRows = welds.map((w, i) =>
    React.createElement(View, {
      key: `wr-${i}`,
      style: i % 2 === 1
        ? { ...S.tableRow, ...S.tableRowAlt }
        : S.tableRow,
    },
      React.createElement(Text, { style: { ...S.tableCell, width: '25%' } }, w.weld_id_number ?? '—'),
      React.createElement(Text, { style: { ...S.tableCell, width: '20%' } }, w.welder_stamp ?? '—'),
      React.createElement(Text, { style: { ...S.tableCell, width: '25%' } }, w.weld_date ?? '—'),
      React.createElement(Text, { style: { ...S.tableCell, width: '30%' } }, w.status ?? '—'),
    )
  )

  bodyChildren.push(section('2. Weld Summary', 'sec2',
    React.createElement(View, { style: S.tableHeader, key: 'weld-hdr' },
      React.createElement(Text, { style: { ...S.tableHeaderCell, width: '25%' } }, 'Weld No.'),
      React.createElement(Text, { style: { ...S.tableHeaderCell, width: '20%' } }, 'Welder Stamp'),
      React.createElement(Text, { style: { ...S.tableHeaderCell, width: '25%' } }, 'Weld Date'),
      React.createElement(Text, { style: { ...S.tableHeaderCell, width: '30%' } }, 'Status'),
    ),
    ...(weldTableRows.length > 0
      ? weldTableRows
      : [React.createElement(Text, { style: S.noItems, key: 'no-welds' }, 'No welds recorded for this spool.')]
    ),
    React.createElement(View, { style: S.weldSummary, key: 'weld-sum' },
      React.createElement(Text, { style: S.weldSummaryItem }, `Total Welds: ${totalWelds}`),
      React.createElement(Text, { style: S.weldSummaryItem }, `Accepted: ${acceptedWelds}`),
      React.createElement(Text, { style: S.weldSummaryItem }, `Pass Rate: ${passRate}%`),
    ),
  ))

  // ── Section 3: Bill of Materials ──
  const items = spool.spool_items ?? []
  if (items.length > 0) {
    const itemRows = items.map((it, i) =>
      React.createElement(View, {
        key: `ir-${i}`,
        style: i % 2 === 1
          ? { ...S.tableRow, ...S.tableRowAlt }
          : S.tableRow,
      },
        React.createElement(Text, { style: { ...S.tableCell, width: '15%' } }, it.item_type),
        React.createElement(Text, { style: { ...S.tableCell, width: '40%' } }, it.description),
        React.createElement(Text, { style: { ...S.tableCell, width: '10%' } }, String(it.quantity)),
        React.createElement(Text, { style: { ...S.tableCell, width: '15%' } },
          it.length_in != null ? `${it.length_in}"` : '—'),
        React.createElement(Text, { style: { ...S.tableCell, width: '20%' } }, it.heat_number ?? '—'),
      )
    )

    bodyChildren.push(section('3. Bill of Materials', 'sec3',
      React.createElement(View, { style: S.tableHeader, key: 'bom-hdr' },
        React.createElement(Text, { style: { ...S.tableHeaderCell, width: '15%' } }, 'Type'),
        React.createElement(Text, { style: { ...S.tableHeaderCell, width: '40%' } }, 'Description'),
        React.createElement(Text, { style: { ...S.tableHeaderCell, width: '10%' } }, 'Qty'),
        React.createElement(Text, { style: { ...S.tableHeaderCell, width: '15%' } }, 'Length'),
        React.createElement(Text, { style: { ...S.tableHeaderCell, width: '20%' } }, 'Heat No.'),
      ),
      ...itemRows,
    ))
  }

  // ── Section 4: Certification Statement ──
  const certSectionNum = items.length > 0 ? '4' : '3'
  bodyChildren.push(section(`${certSectionNum}. Certification`, 'sec4',
    React.createElement(Text, { style: S.certText, key: 'cert-stmt' },
      'This spool has been fabricated, inspected, and tested in accordance with the applicable codes and project ' +
      'specifications, and is hereby released for field installation.'
    ),
  ))

  // ── Section 5: Sign-off ──
  const signSectionNum = items.length > 0 ? '5' : '4'
  bodyChildren.push(section(`${signSectionNum}. Authorization Sign-off`, 'sec5',
    React.createElement(View, { style: S.signatureRow, key: 'sig1' },
      React.createElement(View, { style: S.signatureBlock, key: 'sb1' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Prepared by (Print Name / Signature)'),
      ),
      React.createElement(View, { style: { ...S.signatureBlock, maxWidth: 120 }, key: 'sd1' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Date'),
      ),
    ),
    React.createElement(View, { style: S.signatureRow, key: 'sig2' },
      React.createElement(View, { style: S.signatureBlock, key: 'sb2' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'QC Inspector (Print Name / Signature)'),
      ),
      React.createElement(View, { style: { ...S.signatureBlock, maxWidth: 120 }, key: 'sd2' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Date'),
      ),
    ),
    React.createElement(View, { style: S.signatureRow, key: 'sig3' },
      React.createElement(View, { style: S.signatureBlock, key: 'sb3' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Approved by (Print Name / Signature)'),
      ),
      React.createElement(View, { style: { ...S.signatureBlock, maxWidth: 120 }, key: 'sd3' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Date'),
      ),
    ),
  ))

  children.push(React.createElement(View, { style: S.body, key: 'body' }, ...bodyChildren))

  // ── Footer ──
  children.push(
    React.createElement(View, { style: S.footer, fixed: true, key: 'footer' },
      React.createElement(Text, null,
        `Generated by PipeField OS  •  ${dateStr}  •  ${spool.spool_number}`
      ),
      React.createElement(Text, {
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`,
      }),
    )
  )

  return React.createElement(Document, { title: `Spool Release Certificate — ${spool.spool_number}` },
    React.createElement(Page, { size: 'A4', style: S.page }, ...children)
  )
}

// ── Route Handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await req.json()
    const spoolId = body?.spoolId
    if (!spoolId || typeof spoolId !== 'string') {
      return NextResponse.json({ error: 'spoolId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const orgId = caller.organization_id

    // Fetch spool with joins (scoped to org to prevent IDOR)
    const { data: spool, error: spoolError } = await supabase
      .from('spools')
      .select(`
        *,
        project:projects(name, project_number),
        spool_items(*),
        welds:welds(weld_id_number, status, welder_stamp, welder_name, weld_date)
      `)
      .eq('id', spoolId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (spoolError) {
      console.error('Spool fetch error:', spoolError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!spool) {
      return NextResponse.json({ error: 'Spool not found' }, { status: 404 })
    }

    // Fetch org name
    const admin = createAdminClient()
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()

    const orgName = org?.name ?? 'Organization'

    const doc = buildPdf(spool as unknown as SpoolData, orgName)
    const buffer = await renderToBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="spool-release-${spool.spool_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 }
    )
  }
}

// POST /api/reports/pressure-test-certificate
// Body: { testId: string }
// Returns a PDF pressure test certificate.
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
    backgroundColor: '#ffffff',
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 48,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
    paddingBottom: 12,
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerOrgName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 2,
  },
  headerRight: {
    textAlign: 'right',
  },
  headerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: '#1e40af',
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  headerCertNo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#1e293b',
    marginTop: 4,
  },
  // Section
  sectionWrap: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#1e40af',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    paddingBottom: 3,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Row
  row: {
    flexDirection: 'row',
    paddingVertical: 2.5,
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
  },
  // Two-column grid
  grid2: {
    flexDirection: 'row',
    gap: 12,
  },
  grid2Col: {
    flex: 1,
  },
  // Result box
  resultBox: {
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  resultBoxPass: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#059669',
  },
  resultBoxFail: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  resultText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    letterSpacing: 2,
  },
  resultTextPass: {
    color: '#059669',
  },
  resultTextFail: {
    color: '#dc2626',
  },
  // Notes
  notesText: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.5,
  },
  // Certification
  certText: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.6,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  signatureBlock: {
    flex: 1,
    marginRight: 16,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    marginBottom: 3,
    height: 18,
  },
  signatureLabel: {
    fontSize: 8,
    color: '#94a3b8',
  },
  signatureValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#1e293b',
    marginBottom: 2,
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
})

// ── Helpers ────────────────────────────────────────────────────

function row(label: string, value: string) {
  return React.createElement(View, { style: S.row, key: label },
    React.createElement(Text, { style: S.label }, label),
    React.createElement(Text, { style: S.value }, value),
  )
}

function section(title: string, ...children: React.ReactElement[]) {
  return React.createElement(View, { style: S.sectionWrap },
    React.createElement(Text, { style: S.sectionTitle }, title),
    ...children,
  )
}

// ── PDF Builder ────────────────────────────────────────────────

interface PressureTestData {
  id: string
  test_number: string
  system_name: string
  line_numbers: string | null
  test_type: string
  test_medium: string
  design_pressure: number | null
  test_pressure: number
  pressure_unit: string
  hold_duration_min: number
  test_date: string
  test_start_time: string | null
  test_end_time: string | null
  initial_pressure: number | null
  final_pressure: number | null
  ambient_temp: string | null
  result: string
  failure_reason: string | null
  inspector_name: string
  witness_name: string | null
  notes: string | null
  status: string
  approved_at: string | null
  created_by: string | null
  project: { name: string; project_number: string } | null
  created_by_user: { full_name: string } | null
}

const PT_TYPE_LABELS: Record<string, string> = {
  hydrostatic: 'Hydrostatic',
  pneumatic:   'Pneumatic',
  leak:        'Leak Test',
  service:     'Service Test',
}

function buildPdf(test: PressureTestData, orgName: string) {
  const now = new Date().toLocaleDateString('en-CA')

  const pressureDrop = (test.initial_pressure != null && test.final_pressure != null)
    ? (test.initial_pressure - test.final_pressure).toFixed(2)
    : 'N/A'

  const isPass = test.result === 'pass' || test.result === 'conditional_pass'

  const children: React.ReactElement[] = []

  // ── Header ──
  children.push(
    React.createElement(View, { style: S.header, key: 'header' },
      React.createElement(View, { style: S.headerLeft, key: 'hl' },
        React.createElement(Text, { style: S.headerOrgName }, orgName),
      ),
      React.createElement(View, { style: S.headerRight, key: 'hr' },
        React.createElement(Text, { style: S.headerTitle }, 'PRESSURE TEST CERTIFICATE'),
        React.createElement(Text, { style: S.headerSubtitle }, 'Field Pressure Test Record'),
        React.createElement(Text, { style: S.headerCertNo }, `Certificate No: ${test.test_number}`),
      ),
    )
  )

  // ── Project Information ──
  children.push(section('Project Information',
    React.createElement(View, { style: S.grid2, key: 'proj-grid' },
      React.createElement(View, { style: S.grid2Col, key: 'pc1' },
        row('Project', test.project?.name ?? 'N/A'),
        row('Project No.', test.project?.project_number ?? 'N/A'),
        row('System', test.system_name),
      ),
      React.createElement(View, { style: S.grid2Col, key: 'pc2' },
        row('Test Type', PT_TYPE_LABELS[test.test_type] ?? test.test_type),
        row('Line Numbers', test.line_numbers ?? 'N/A'),
      ),
    )
  ))

  // ── Test Parameters ──
  children.push(section('Test Parameters',
    React.createElement(View, { style: S.grid2, key: 'param-grid' },
      React.createElement(View, { style: S.grid2Col, key: 'tp1' },
        row('Test Medium', test.test_medium),
        row('Required Test Pressure', `${test.test_pressure} ${test.pressure_unit}`),
        row('Initial Pressure', test.initial_pressure != null ? `${test.initial_pressure} ${test.pressure_unit}` : 'N/A'),
        row('Final Pressure', test.final_pressure != null ? `${test.final_pressure} ${test.pressure_unit}` : 'N/A'),
        row('Pressure Drop', pressureDrop !== 'N/A' ? `${pressureDrop} ${test.pressure_unit}` : 'N/A'),
      ),
      React.createElement(View, { style: S.grid2Col, key: 'tp2' },
        row('Test Duration', `${test.hold_duration_min} minutes`),
        row('Test Date', test.test_date),
        row('Start Time', test.test_start_time ?? 'N/A'),
        row('End Time', test.test_end_time ?? 'N/A'),
        ...(test.design_pressure != null
          ? [row('Design Pressure', `${test.design_pressure} ${test.pressure_unit}`)]
          : []
        ),
      ),
    )
  ))

  // ── Test Result ──
  const resultLabel = isPass
    ? (test.result === 'conditional_pass' ? 'CONDITIONAL PASS' : 'PASS')
    : 'FAIL'

  children.push(section('Test Result',
    React.createElement(View, {
      style: { ...S.resultBox, ...(isPass ? S.resultBoxPass : S.resultBoxFail) },
      key: 'result-box',
    },
      React.createElement(Text, {
        style: { ...S.resultText, ...(isPass ? S.resultTextPass : S.resultTextFail) },
      }, isPass ? `✓ ${resultLabel}` : `✗ ${resultLabel}`),
    ),
    ...(test.ambient_temp ? [row('Temperature at Test', `${test.ambient_temp}`)] : []),
    ...(test.failure_reason ? [row('Failure Reason', test.failure_reason)] : []),
    row('Inspector', test.inspector_name),
    ...(test.witness_name ? [row('Witness', test.witness_name)] : []),
  ))

  // ── Notes ──
  children.push(section('Notes',
    React.createElement(Text, { style: S.notesText, key: 'notes-text' },
      test.notes?.trim() || 'No additional notes.'
    )
  ))

  // ── Certification ──
  const conductedBy = test.created_by_user?.full_name ?? test.inspector_name ?? 'N/A'

  children.push(section('Certification',
    React.createElement(Text, { style: S.certText, key: 'cert-text' },
      'I certify that the above pressure test was conducted in accordance with the applicable codes and specifications, ' +
      'and that all information recorded herein is true and accurate to the best of my knowledge.'
    ),
    React.createElement(View, { style: S.signatureRow, key: 'sig-row-1' },
      React.createElement(View, { style: S.signatureBlock, key: 'sb1' },
        React.createElement(Text, { style: S.signatureValue }, conductedBy),
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Conducted By (Print Name)'),
      ),
      React.createElement(View, { style: { ...S.signatureBlock, marginRight: 0 }, key: 'sb2' },
        React.createElement(Text, { style: S.signatureValue }, test.test_date),
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Date of Test'),
      ),
    ),
    React.createElement(View, { style: S.signatureRow, key: 'sig-row-2' },
      React.createElement(View, { style: S.signatureBlock, key: 'sb3' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Inspector Signature'),
      ),
      React.createElement(View, { style: { ...S.signatureBlock, marginRight: 0 }, key: 'sb4' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Date'),
      ),
    ),
    React.createElement(View, { style: S.signatureRow, key: 'sig-row-3' },
      React.createElement(View, { style: S.signatureBlock, key: 'sb5' },
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Approved By'),
      ),
      React.createElement(View, { style: { ...S.signatureBlock, marginRight: 0 }, key: 'sb6' },
        React.createElement(Text, { style: S.signatureValue }, test.approved_at ? new Date(test.approved_at).toLocaleDateString('en-CA') : ''),
        React.createElement(View, { style: S.signatureLine }),
        React.createElement(Text, { style: S.signatureLabel }, 'Approval Date'),
      ),
    ),
  ))

  // ── Footer ──
  children.push(
    React.createElement(View, { style: S.footer, fixed: true, key: 'footer' },
      React.createElement(Text, null, `Generated by PipeField OS  •  ${now}`),
      React.createElement(Text, {
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`,
      }),
    )
  )

  return React.createElement(Document, { title: `Pressure Test Certificate — ${test.test_number}` },
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
    const testId = body?.testId
    if (!testId || typeof testId !== 'string') {
      return NextResponse.json({ error: 'testId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const orgId = caller.organization_id

    // Fetch the pressure test (scoped to org to prevent IDOR)
    const { data: test, error: testError } = await supabase
      .from('pressure_tests')
      .select('*, project:projects(name, project_number), created_by_user:user_profiles!pressure_tests_created_by_fkey(full_name)')
      .eq('id', testId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (testError) {
      console.error('Pressure test fetch error:', testError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!test) {
      return NextResponse.json({ error: 'Pressure test not found' }, { status: 404 })
    }

    // Fetch org name
    const admin = createAdminClient()
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()

    const orgName = org?.name ?? 'Organization'

    const doc = buildPdf(test as PressureTestData, orgName)
    const buffer = await renderToBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="pressure-test-cert-${test.test_number}.pdf"`,
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#334155',
    backgroundColor: '#ffffff',
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
  },
  // Cover page
  coverPage: {
    fontFamily: 'Helvetica',
    backgroundColor: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 64,
  },
  coverAccent: {
    width: 64,
    height: 6,
    backgroundColor: '#f97316',
    borderRadius: 3,
    marginBottom: 32,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#f97316',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 2,
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 40,
  },
  coverCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 24,
    width: '100%',
    marginBottom: 24,
  },
  coverLabel: {
    fontSize: 8,
    color: '#64748b',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#f1f5f9',
    marginBottom: 16,
  },
  coverRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  coverRowItem: {
    flex: 1,
  },
  coverDate: {
    fontSize: 9,
    color: '#475569',
    textAlign: 'center',
    marginTop: 24,
  },
  // Section header
  sectionHeader: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 0,
    marginTop: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#f1f5f9',
    letterSpacing: 0.5,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 9,
    color: '#334155',
  },
  tableCellMono: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#f97316',
  },
  // NDE section
  ndeWeldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginTop: 4,
  },
  ndeWeldLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  passChip: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  passText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
  },
  failChip: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  failText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
  },
  emptyNde: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  emptyNdeText: {
    fontSize: 9,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: '#94a3b8',
  },
  footerCenter: {
    fontSize: 7,
    color: '#f97316',
    fontFamily: 'Helvetica-Bold',
  },
})

// ── Column widths for weld log table ─────────────────────────
const COL = {
  weld:    '14%',
  stamp:   '12%',
  date:    '13%',
  status:  '16%',
  process: '14%',
  size:    '13%',
  spool:   '18%',
}

// ── PDF Document component ─────────────────────────────────────
interface QAWeld {
  id: string
  weld_id_number: string | null
  welder_stamp: string | null
  welder_name: string | null
  weld_date: string | null
  status: string | null
  weld_process: string | null
  pipe_size: string | null
  spool_number: string | null
}

interface NdeInspection {
  id: string
  weld_id: string
  inspection_type: string | null
  result: string | null
  inspector_name: string | null
  inspection_date: string | null
  report_number: string | null
}

function QAPackage({
  orgName,
  project,
  welds,
  ndeByWeld,
  generatedDate,
}: {
  orgName: string
  project: { name: string; project_number: string | null; client_name: string | null }
  welds: QAWeld[]
  ndeByWeld: Record<string, NdeInspection[]>
  generatedDate: string
}): React.ReactElement<DocumentProps> {
  const projectNumber = project.project_number ?? '—'

  return React.createElement(
    Document,
    null,
    // ── Cover Page ──
    React.createElement(
      Page,
      { size: 'LETTER', style: styles.coverPage },
      React.createElement(View, { style: styles.coverAccent }),
      React.createElement(Text, { style: styles.coverTitle }, 'WELD QA PACKAGE'),
      React.createElement(Text, { style: styles.coverSubtitle }, orgName),
      React.createElement(
        View,
        { style: styles.coverCard },
        React.createElement(Text, { style: styles.coverLabel }, 'Project'),
        React.createElement(Text, { style: styles.coverValue }, project.name),
        React.createElement(
          View,
          { style: styles.coverRow },
          React.createElement(
            View,
            { style: styles.coverRowItem },
            React.createElement(Text, { style: styles.coverLabel }, 'Project Number'),
            React.createElement(Text, { style: { ...styles.coverValue, fontSize: 13 } }, projectNumber),
          ),
          React.createElement(
            View,
            { style: styles.coverRowItem },
            React.createElement(Text, { style: styles.coverLabel }, 'Client'),
            React.createElement(Text, { style: { ...styles.coverValue, fontSize: 13 } }, project.client_name ?? '—'),
          ),
          React.createElement(
            View,
            { style: styles.coverRowItem },
            React.createElement(Text, { style: styles.coverLabel }, 'Total Welds'),
            React.createElement(Text, { style: { ...styles.coverValue, fontSize: 13 } }, String(welds.length)),
          ),
        ),
      ),
      React.createElement(Text, { style: styles.coverDate }, `Generated: ${generatedDate}`),
    ),

    // ── Weld Log Page(s) ──
    React.createElement(
      Page,
      { size: 'LETTER', style: styles.page },
      React.createElement(
        View,
        { style: styles.sectionHeader },
        React.createElement(Text, { style: styles.sectionTitle }, 'WELD LOG'),
      ),
      // Table header
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: COL.weld } }, 'Weld #'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: COL.stamp } }, 'Stamp'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: COL.date } }, 'Date'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: COL.status } }, 'Status'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: COL.process } }, 'Process'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: COL.size } }, 'Pipe Size'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: COL.spool } }, 'Spool'),
      ),
      // Table rows
      ...welds.map((w, i) =>
        React.createElement(
          View,
          { key: w.id, style: i % 2 === 0 ? styles.tableRow : styles.tableRowAlt },
          React.createElement(Text, { style: { ...styles.tableCellMono, width: COL.weld } }, w.weld_id_number ?? '—'),
          React.createElement(Text, { style: { ...styles.tableCell, width: COL.stamp } }, w.welder_stamp ?? '—'),
          React.createElement(Text, { style: { ...styles.tableCell, width: COL.date } }, w.weld_date ?? '—'),
          React.createElement(Text, { style: { ...styles.tableCell, width: COL.status } }, w.status ?? '—'),
          React.createElement(Text, { style: { ...styles.tableCell, width: COL.process } }, w.weld_process ?? '—'),
          React.createElement(Text, { style: { ...styles.tableCell, width: COL.size } }, w.pipe_size ?? '—'),
          React.createElement(Text, { style: { ...styles.tableCell, width: COL.spool } }, w.spool_number ?? '—'),
        ),
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(
          Text,
          { style: styles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}` },
        ),
        React.createElement(Text, { style: styles.footerCenter }, `Project: ${projectNumber}`),
        React.createElement(Text, { style: styles.footerText }, 'CONFIDENTIAL'),
      ),
    ),

    // ── NDE Results Page(s) ──
    React.createElement(
      Page,
      { size: 'LETTER', style: styles.page },
      React.createElement(
        View,
        { style: styles.sectionHeader },
        React.createElement(Text, { style: styles.sectionTitle }, 'NDE INSPECTION RESULTS'),
      ),
      // NDE table header
      React.createElement(
        View,
        { style: { ...styles.tableHeader, marginTop: 0 } },
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: '18%' } }, 'Type'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: '14%' } }, 'Result'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: '24%' } }, 'Inspector'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: '16%' } }, 'Date'),
        React.createElement(Text, { style: { ...styles.tableHeaderCell, width: '28%' } }, 'Report #'),
      ),
      ...welds.flatMap(w => {
        const inspections = ndeByWeld[w.id] ?? []
        const weldHeader = React.createElement(
          View,
          { key: `wh-${w.id}`, style: styles.ndeWeldHeader },
          React.createElement(Text, { style: styles.ndeWeldLabel }, `Weld: ${w.weld_id_number ?? '—'}`),
          inspections.length === 0
            ? React.createElement(Text, { style: { fontSize: 8, color: '#94a3b8', marginLeft: 8 } }, 'No inspections')
            : null,
        )
        if (inspections.length === 0) return [weldHeader]

        return [
          weldHeader,
          ...inspections.map((ins, j) =>
            React.createElement(
              View,
              { key: `ins-${ins.id}`, style: j % 2 === 0 ? styles.tableRow : styles.tableRowAlt },
              React.createElement(Text, { style: { ...styles.tableCell, width: '18%' } }, ins.inspection_type ?? '—'),
              React.createElement(
                View,
                { style: { width: '14%' } },
                ins.result === 'pass'
                  ? React.createElement(View, { style: styles.passChip },
                      React.createElement(Text, { style: styles.passText }, 'PASS'))
                  : ins.result === 'fail'
                  ? React.createElement(View, { style: styles.failChip },
                      React.createElement(Text, { style: styles.failText }, 'FAIL'))
                  : React.createElement(Text, { style: styles.tableCell }, ins.result ?? '—'),
              ),
              React.createElement(Text, { style: { ...styles.tableCell, width: '24%' } }, ins.inspector_name ?? '—'),
              React.createElement(Text, { style: { ...styles.tableCell, width: '16%' } }, ins.inspection_date ?? '—'),
              React.createElement(Text, { style: { ...styles.tableCell, width: '28%' } }, ins.report_number ?? '—'),
            ),
          ),
        ]
      }),
      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(
          Text,
          { style: styles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}` },
        ),
        React.createElement(Text, { style: styles.footerCenter }, `Project: ${projectNumber}`),
        React.createElement(Text, { style: styles.footerText }, 'CONFIDENTIAL'),
      ),
    ),
  )
}

// ── Route Handler ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // Auth gate — QA packages contain sensitive project data
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch in parallel — note project is org-scoped to prevent cross-org access
    const [projectRes, weldsRes, orgRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, project_number, client_name, organization_id')
        .eq('id', projectId)
        .eq('organization_id', caller.organization_id)
        .maybeSingle(),
      supabase
        .from('welds')
        .select('id, weld_id_number, welder_stamp, welder_name, weld_date, status, weld_process, pipe_size, spool_number')
        .eq('project_id', projectId)
        .eq('organization_id', caller.organization_id)
        .order('weld_date', { ascending: true }),
      supabase
        .from('organizations')
        .select('name')
        .eq('id', caller.organization_id)
        .maybeSingle(),
    ])

    if (projectRes.error || !projectRes.data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = projectRes.data
    const welds   = (weldsRes.data ?? []) as QAWeld[]
    const orgName = orgRes.data?.name ?? 'PipeField OS'

    // Fetch NDE inspections for all welds
    let ndeByWeld: Record<string, NdeInspection[]> = {}
    if (welds.length > 0) {
      const weldIds = welds.map(w => w.id)
      const { data: nde } = await supabase
        .from('nde_inspections')
        .select('id, weld_id, inspection_type, result, inspector_name, inspection_date, report_number')
        .in('weld_id', weldIds)
        .order('inspection_date', { ascending: true })

      for (const ins of nde ?? []) {
        if (!ndeByWeld[ins.weld_id]) ndeByWeld[ins.weld_id] = []
        ndeByWeld[ins.weld_id].push(ins)
      }
    }

    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    // Call QAPackage directly (plain function) so the return type resolves to
    // React.ReactElement<DocumentProps> — what renderToBuffer expects.
    const pdfElement = QAPackage({ orgName, project, welds, ndeByWeld, generatedDate })
    const buffer = await renderToBuffer(pdfElement)

    const projectNumber = project.project_number ?? project.id.slice(0, 8)
    const filename = `QA-Package-${projectNumber.replace(/[^a-zA-Z0-9-_]/g, '-')}.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('[/api/reports/qa-package]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

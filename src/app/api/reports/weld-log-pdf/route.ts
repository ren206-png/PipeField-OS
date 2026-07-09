// POST /api/reports/weld-log-pdf
// Body: { projectId?, status?, welderStamp?, dateFrom?, dateTo?, search? }
// Returns a landscape A4 PDF of the weld log.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'

// ── Status labels (inline — no import needed) ──────────────────
const WELD_STATUS_LABELS: Record<string, string> = {
  pending:    'Pending',
  in_progress: 'In Progress',
  accepted:   'Accepted',
  failed:     'Failed',
  repaired:   'Repaired',
  rejected:   'Rejected',
}

// ── Styles ─────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#ffffff',
    backgroundColor: '#0f172a',
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#f97316',
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: '#f97316',
  },
  headerSub: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerRight: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#94a3b8',
  },
  // Filter summary
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  filterTag: {
    fontSize: 7,
    color: '#f97316',
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  // Table header
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#f97316',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  thText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#f97316',
    textTransform: 'uppercase',
  },
  // Table rows
  tableRowEven: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e293b',
  },
  tableRowOdd: {
    flexDirection: 'row',
    backgroundColor: '#162032',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e293b',
  },
  tdText: {
    fontSize: 7.5,
    color: '#e2e8f0',
  },
  tdMono: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#fb923c',
  },
  tdMuted: {
    fontSize: 7.5,
    color: '#94a3b8',
  },
  // Column widths (landscape A4 ~ 802pt usable)
  colWeldNo:  { width: 70 },
  colProject: { width: 130 },
  colSpool:   { width: 70 },
  colLine:    { width: 65 },
  colSize:    { width: 55 },
  colProcess: { width: 65 },
  colWelder:  { width: 90 },
  colDate:    { width: 65 },
  colStatus:  { width: 80 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#475569',
    borderTopWidth: 0.5,
    borderTopColor: '#1e293b',
    paddingTop: 4,
  },
})

interface WeldRow {
  weld_id_number: string
  project_name:   string
  spool_number:   string | null
  line_number:    string | null
  pipe_size:      string | null
  weld_process:   string | null
  welder_stamp:   string | null
  welder_name:    string | null
  weld_date:      string | null
  status:         string
}

function buildPdf(
  rows: WeldRow[],
  orgName: string,
  filters: { projectName?: string; dateFrom?: string; dateTo?: string; status?: string },
) {
  const now = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

  // ── Filter tags ──
  const tags: string[] = []
  if (filters.projectName) tags.push(`Project: ${filters.projectName}`)
  if (filters.status)      tags.push(`Status: ${WELD_STATUS_LABELS[filters.status] ?? filters.status}`)
  if (filters.dateFrom || filters.dateTo) {
    tags.push(`Date: ${filters.dateFrom ?? '…'} — ${filters.dateTo ?? 'present'}`)
  }

  const colDefs = [
    { label: 'Weld No.',        style: S.colWeldNo  },
    { label: 'Project',         style: S.colProject },
    { label: 'Spool',           style: S.colSpool   },
    { label: 'Line No.',        style: S.colLine    },
    { label: 'Size',            style: S.colSize    },
    { label: 'Process',         style: S.colProcess },
    { label: 'Welder (Stamp)',  style: S.colWelder  },
    { label: 'Weld Date',       style: S.colDate    },
    { label: 'Status',          style: S.colStatus  },
  ]

  // Header element
  const header = React.createElement(View, { style: S.header, key: 'hdr' },
    React.createElement(View, { key: 'hl' },
      React.createElement(Text, { style: S.headerTitle }, 'WELD LOG REPORT'),
      React.createElement(Text, { style: S.headerSub }, orgName),
    ),
    React.createElement(View, { style: S.headerRight, key: 'hr' },
      React.createElement(Text, null, `Generated: ${now}`),
      React.createElement(Text, null, 'PipeField OS'),
      React.createElement(Text, null, `${rows.length} records`),
    ),
  )

  // Filter summary
  const filterSummary = tags.length > 0
    ? React.createElement(View, { style: S.filterRow, key: 'filters' },
        ...tags.map((t, i) =>
          React.createElement(Text, { style: S.filterTag, key: i }, t)
        )
      )
    : null

  // Table header
  const tableHead = React.createElement(View, { style: S.tableHead, key: 'thead' },
    ...colDefs.map((col, i) =>
      React.createElement(View, { style: col.style, key: i },
        React.createElement(Text, { style: S.thText }, col.label),
      )
    )
  )

  // Table rows
  const tableRows = rows.map((row, idx) => {
    const rowStyle = idx % 2 === 0 ? S.tableRowEven : S.tableRowOdd
    const welderCell = row.welder_stamp
      ? `${row.welder_name ?? '—'} (${row.welder_stamp})`
      : (row.welder_name ?? '—')

    return React.createElement(View, { style: rowStyle, key: `r${idx}` },
      React.createElement(View, { style: S.colWeldNo  }, React.createElement(Text, { style: S.tdMono  }, row.weld_id_number)),
      React.createElement(View, { style: S.colProject }, React.createElement(Text, { style: S.tdText  }, row.project_name)),
      React.createElement(View, { style: S.colSpool   }, React.createElement(Text, { style: S.tdMuted }, row.spool_number  ?? '—')),
      React.createElement(View, { style: S.colLine    }, React.createElement(Text, { style: S.tdMuted }, row.line_number   ?? '—')),
      React.createElement(View, { style: S.colSize    }, React.createElement(Text, { style: S.tdMuted }, row.pipe_size     ?? '—')),
      React.createElement(View, { style: S.colProcess }, React.createElement(Text, { style: S.tdMuted }, row.weld_process  ?? '—')),
      React.createElement(View, { style: S.colWelder  }, React.createElement(Text, { style: S.tdText  }, welderCell)),
      React.createElement(View, { style: S.colDate    }, React.createElement(Text, { style: S.tdMuted }, row.weld_date     ?? '—')),
      React.createElement(View, { style: S.colStatus  }, React.createElement(Text, { style: S.tdText  }, WELD_STATUS_LABELS[row.status] ?? row.status)),
    )
  })

  // Footer
  const footer = React.createElement(View, { style: S.footer, fixed: true, key: 'footer' },
    React.createElement(Text, null, 'PipeField OS — Weld Log Report'),
    React.createElement(Text, {
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Page ${pageNumber} of ${totalPages}`,
    }),
  )

  const pageChildren: React.ReactElement[] = [
    header,
    ...(filterSummary ? [filterSummary] : []),
    tableHead,
    ...tableRows,
    footer,
  ]

  return React.createElement(Document, { title: 'Weld Log Report' },
    React.createElement(Page, { size: 'A4', orientation: 'landscape', style: S.page },
      ...pageChildren,
    )
  )
}

// ── Route handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const body = await req.json() as {
      projectId?:   string
      status?:      string
      welderStamp?: string
      dateFrom?:    string
      dateTo?:      string
      search?:      string
    }

    const supabase = await createClient()

    // ── Fetch org name ──
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', caller.organization_id)
      .maybeSingle()
    const orgName = (orgData as { name?: string } | null)?.name ?? 'PipeField OS'

    // ── Build weld query ──
    let query = supabase
      .from('welds')
      .select('weld_id_number, status, welder_stamp, welder_name, weld_date, spool_number, line_number, pipe_size, weld_process, project:projects(name, project_number)')
      .eq('organization_id', caller.organization_id)
      .order('weld_date',  { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)

    if (body.projectId)   query = query.eq('project_id',    body.projectId)
    if (body.status)      query = query.eq('status',         body.status)
    if (body.welderStamp) query = query.ilike('welder_stamp', `%${body.welderStamp}%`)
    if (body.dateFrom)    query = query.gte('weld_date',     body.dateFrom)
    if (body.dateTo)      query = query.lte('weld_date',     body.dateTo)
    if (body.search)      query = query.or(
      `weld_id_number.ilike.%${body.search}%,welder_name.ilike.%${body.search}%,spool_number.ilike.%${body.search}%`
    )

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Resolve project name for filter summary ──
    let projectName: string | undefined
    if (body.projectId && data && data.length > 0) {
      const firstRow = data[0] as { project?: { name?: string } | null }
      projectName = firstRow.project?.name ?? undefined
    }

    // ── Map rows ──
    const rows: WeldRow[] = (data ?? []).map((w) => {
      const proj = w.project as { name?: string; project_number?: string } | null
      return {
      weld_id_number: w.weld_id_number,
      project_name:   proj?.name ?? '—',
      spool_number:   w.spool_number,
      line_number:    w.line_number,
      pipe_size:      w.pipe_size,
      weld_process:   w.weld_process,
      welder_stamp:   w.welder_stamp,
      welder_name:    w.welder_name,
      weld_date:      w.weld_date,
      status:         w.status,
    }})

    // ── Generate PDF ──
    const doc = buildPdf(rows, orgName, {
      projectName,
      dateFrom: body.dateFrom,
      dateTo:   body.dateTo,
      status:   body.status,
    })
    const buffer = await renderToBuffer(doc)

    const dateStr = new Date().toISOString().split('T')[0]

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="weld-log-${dateStr}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Weld log PDF error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF generation failed' },
      { status: 500 },
    )
  }
}

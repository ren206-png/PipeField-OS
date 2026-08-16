// POST /api/projects/[id]/audit-pack
// Generates a compliance audit package for a project in JSON or PDF format.
import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

export const dynamic = 'force-dynamic'

const schema = z.object({
  format: z.enum(['PDF', 'JSON']),
})

// ── Brand colours (mirrors turnover/pdf-renderer.ts palette) ──
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
  // Cover
  coverHero: {
    marginTop:       60,
    marginBottom:    40,
    borderLeftWidth: 4,
    borderLeftColor: C.orange,
    paddingLeft:     16,
  },
  coverTitle: { fontFamily: 'Helvetica-Bold', fontSize: 22, color: C.orange, marginBottom: 6 },
  coverSub:   { fontSize: 11, color: C.white,  marginBottom: 4 },
  coverMeta:  { fontSize: 8.5, color: C.muted, marginTop: 2 },
  // Meta rows
  coverTable: { marginTop: 24, borderWidth: 1, borderColor: C.border },
  coverRow:   { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border, paddingVertical: 6, paddingHorizontal: 10 },
  coverLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.muted, width: 140 },
  coverValue: { fontSize: 7.5, color: C.white, flex: 1 },
  // Summary stat boxes
  statRow:    { flexDirection: 'row', gap: 8, marginTop: 16 },
  statBox:    { flex: 1, borderWidth: 1, borderColor: C.border, padding: 10, backgroundColor: C.surface },
  statValue:  { fontFamily: 'Helvetica-Bold', fontSize: 18, color: C.orange, marginBottom: 2 },
  statLabel:  { fontSize: 7, color: C.muted },
  // Tables
  tableHead: {
    flexDirection:     'row',
    backgroundColor:   C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.orange,
    paddingVertical:   4,
    paddingHorizontal: 4,
  },
  th:      { fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.orange, textTransform: 'uppercase' },
  rowEven: { flexDirection: 'row', backgroundColor: C.bg,      paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.surface },
  rowOdd:  { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.surface },
  td:      { fontSize: 7.5, color: C.white  },
  tdMuted: { fontSize: 7.5, color: C.muted  },
  tdGreen: { fontSize: 7.5, color: C.green  },
  tdRed:   { fontSize: 7.5, color: C.red    },
  tdYellow:{ fontSize: 7.5, color: C.yellow },
  tdMono:  { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.orange },
  emptyMsg:{ fontSize: 8, color: C.muted, marginTop: 8 },
  // Footer
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
  footerText: { fontSize: 7, color: C.muted },
  // Disclaimer
  disclaimerBox: {
    marginTop:       24,
    backgroundColor: '#1a0a00',
    borderWidth:     1,
    borderColor:     '#7c2d12',
    padding:         10,
  },
  disclaimerTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.yellow, marginBottom: 3 },
  disclaimerBody:  { fontSize: 6.5, color: C.muted },
  // Qual / continuity columns
  cName:   { width: 120 },
  cStamp:  { width: 55  },
  cProc:   { width: 65  },
  cExp:    { width: 80  },
  cStatus: { flex: 1    },
})

const el = React.createElement

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function footer(projectName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return el(View, { style: S.footer, fixed: true } as any,
    el(Text, { style: S.footerText }, `Compliance Audit Package — ${projectName}`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    el(Text, {
      style:  S.footerText,
      render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Page ${pageNumber} of ${totalPages}`,
    } as any),
  )
}

function statusColor(s: string | null | undefined) {
  const v = (s ?? '').toLowerCase()
  if (['active', 'current', 'pass', 'accepted', 'complete'].includes(v)) return S.tdGreen
  if (['expired', 'failed', 'rejected'].includes(v))                     return S.tdRed
  if (['pending', 'in_progress'].includes(v))                            return S.tdYellow
  return S.tdMuted
}

// ── Section helpers ───────────────────────────────────────────

type AuditData = {
  project:          Record<string, unknown>
  welds:            Record<string, unknown>[]
  inspections:      Record<string, unknown>[]
  qualifications:   Record<string, unknown>[]
  continuity:       Record<string, unknown>[]
  generated_at:     string
  inspection_pct:   number
}

function coverPage(d: AuditData) {
  const genDate = new Date(d.generated_at).toLocaleDateString('en-CA')
  const proj    = d.project
  const meta: [string, string][] = [
    ['Project',        String(proj.name ?? '—')],
    ['Standard',       String(proj.governing_code ?? 'AWS D1.1')],
    ['Jurisdiction',   String(proj.jurisdiction ?? '—')],
    ['AHJ',            String(proj.ahj ?? '—')],
    ['Generated',      genDate],
    ['Total Welds',    String(d.welds.length)],
    ['Inspection %',   `${d.inspection_pct.toFixed(1)}%`],
  ]
  return el(Page, { size: 'LETTER', style: S.page } as object,
    el(View, { style: S.coverHero },
      el(Text, { style: S.coverTitle }, 'COMPLIANCE AUDIT PACKAGE'),
      el(Text, { style: S.coverSub  }, String(proj.name ?? 'Project')),
      el(Text, { style: S.coverMeta }, `AWS D1.1  ·  ${genDate}`),
    ),
    el(View, { style: S.coverTable },
      ...meta.map(([label, value], i) =>
        el(View, { style: S.coverRow, key: `m${i}` },
          el(Text, { style: S.coverLabel }, label),
          el(Text, { style: S.coverValue }, value),
        ),
      ),
    ),
    footer(String(proj.name ?? '')),
  )
}

function weldSummaryPage(d: AuditData) {
  const inspected = d.welds.filter((w) => {
    const s = String((w as { status?: unknown }).status ?? '')
    return ['accepted', 'complete', 'pass'].includes(s.toLowerCase())
  }).length

  return el(Page, { size: 'LETTER', style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 2 — WELD LOG SUMMARY'),
    el(View, { style: S.statRow },
      el(View, { style: S.statBox }, el(Text, { style: S.statValue }, String(d.welds.length)),   el(Text, { style: S.statLabel }, 'Total Welds')),
      el(View, { style: S.statBox }, el(Text, { style: S.statValue }, String(inspected)),         el(Text, { style: S.statLabel }, 'Accepted')),
      el(View, { style: S.statBox }, el(Text, { style: S.statValue }, `${d.inspection_pct.toFixed(0)}%`), el(Text, { style: S.statLabel }, 'Inspection Complete')),
    ),
    footer(String(d.project.name ?? '')),
  )
}

function qualificationsPage(d: AuditData) {
  const cols = [
    { label: 'Welder Name', style: S.cName  },
    { label: 'Stamp',       style: S.cStamp },
    { label: 'Process',     style: S.cProc  },
    { label: 'Expiry',      style: S.cExp   },
    { label: 'Status',      style: S.cStatus },
  ]
  return el(Page, { size: 'LETTER', style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 3 — WELDER QUALIFICATIONS'),
    d.qualifications.length === 0
      ? el(Text, { style: S.emptyMsg }, 'No welder qualification records found.')
      : el(React.Fragment, null,
          el(View, { style: S.tableHead },
            ...cols.map((c, i) => el(View, { style: c.style, key: `h${i}` }, el(Text, { style: S.th }, c.label))),
          ),
          ...d.qualifications.map((q, i) => {
            const r = q as Record<string, unknown>
            return el(View, { style: i % 2 === 0 ? S.rowEven : S.rowOdd, key: `q${i}` },
              el(View, { style: S.cName  }, el(Text, { style: S.td      }, String(r.welder_name  ?? r.name  ?? '—'))),
              el(View, { style: S.cStamp }, el(Text, { style: S.tdMono  }, String(r.welder_stamp ?? r.stamp ?? '—'))),
              el(View, { style: S.cProc  }, el(Text, { style: S.tdMuted }, String(r.process      ?? r.weld_process ?? '—'))),
              el(View, { style: S.cExp   }, el(Text, { style: S.tdMuted }, String(r.expiry_date  ?? r.expires_at   ?? '—'))),
              el(View, { style: S.cStatus}, el(Text, { style: statusColor(String(r.status ?? '')) }, String(r.status ?? '—'))),
            )
          }),
        ),
    footer(String(d.project.name ?? '')),
  )
}

function continuityPage(d: AuditData) {
  const cols = [
    { label: 'Welder',      style: S.cName  },
    { label: 'Stamp',       style: S.cStamp },
    { label: 'Process',     style: S.cProc  },
    { label: 'Last Weld',   style: S.cExp   },
    { label: 'Status',      style: S.cStatus },
  ]
  return el(Page, { size: 'LETTER', style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 4 — CONTINUITY STATUS'),
    d.continuity.length === 0
      ? el(Text, { style: S.emptyMsg }, 'No continuity records found.')
      : el(React.Fragment, null,
          el(View, { style: S.tableHead },
            ...cols.map((c, i) => el(View, { style: c.style, key: `h${i}` }, el(Text, { style: S.th }, c.label))),
          ),
          ...d.continuity.map((c, i) => {
            const r = c as Record<string, unknown>
            return el(View, { style: i % 2 === 0 ? S.rowEven : S.rowOdd, key: `c${i}` },
              el(View, { style: S.cName  }, el(Text, { style: S.td      }, String(r.welder_name  ?? r.name        ?? '—'))),
              el(View, { style: S.cStamp }, el(Text, { style: S.tdMono  }, String(r.welder_stamp ?? r.stamp       ?? '—'))),
              el(View, { style: S.cProc  }, el(Text, { style: S.tdMuted }, String(r.process      ?? r.weld_process ?? '—'))),
              el(View, { style: S.cExp   }, el(Text, { style: S.tdMuted }, String(r.last_weld_date ?? r.last_active ?? '—'))),
              el(View, { style: S.cStatus}, el(Text, { style: statusColor(String(r.status ?? '')) }, String(r.status ?? '—'))),
            )
          }),
        ),
    footer(String(d.project.name ?? '')),
  )
}

function inspectionPage(d: AuditData) {
  const last20 = d.inspections.slice(0, 20)
  const cols = [
    { label: 'Weld No.',   style: { width: 70  } },
    { label: 'Type',       style: { width: 65  } },
    { label: 'Result',     style: { width: 60  } },
    { label: 'Inspector',  style: { width: 100 } },
    { label: 'Date',       style: { width: 70  } },
    { label: 'Notes',      style: { flex: 1    } },
  ]
  return el(Page, { size: 'LETTER', style: S.page } as object,
    el(Text, { style: S.sectionTitle }, 'SECTION 5 — INSPECTION FINDINGS (LAST 20)'),
    last20.length === 0
      ? el(Text, { style: S.emptyMsg }, 'No inspection records found.')
      : el(React.Fragment, null,
          el(View, { style: S.tableHead },
            ...cols.map((c, i) => el(View, { style: c.style, key: `h${i}` }, el(Text, { style: S.th }, c.label))),
          ),
          ...last20.map((insp, i) => {
            const r = insp as Record<string, unknown>
            return el(View, { style: i % 2 === 0 ? S.rowEven : S.rowOdd, key: `i${i}` },
              el(View, { style: { width: 70  } }, el(Text, { style: S.tdMono  }, String(r.weld_id_number ?? r.weld_no ?? '—'))),
              el(View, { style: { width: 65  } }, el(Text, { style: S.tdMuted }, String(r.inspection_type ?? r.type   ?? '—'))),
              el(View, { style: { width: 60  } }, el(Text, { style: statusColor(String(r.result ?? '')) }, String(r.result ?? 'Pending'))),
              el(View, { style: { width: 100 } }, el(Text, { style: S.tdMuted }, String(r.performed_by ?? r.inspector ?? '—'))),
              el(View, { style: { width: 70  } }, el(Text, { style: S.tdMuted }, String(r.inspection_date ?? r.created_at ?? '—'))),
              el(View, { style: { flex: 1    } }, el(Text, { style: S.tdMuted }, String(r.notes ?? '—'))),
            )
          }),
        ),
    el(View, { style: S.disclaimerBox },
      el(Text, { style: S.disclaimerTitle }, 'ENGINEERING REVIEW REQUIRED'),
      el(Text, { style: S.disclaimerBody  },
        'This compliance audit package is generated by PipeField OS for reference purposes only. ' +
        'All data must be verified by a qualified engineer against project records prior to submission to any client or authority having jurisdiction (AHJ).',
      ),
    ),
    footer(String(d.project.name ?? '')),
  )
}

async function buildPdf(d: AuditData): Promise<Buffer> {
  const doc = el(Document, { title: `Compliance Audit Package — ${String(d.project.name ?? 'Project')} — AWS D1.1` },
    coverPage(d),
    weldSummaryPage(d),
    qualificationsPage(d),
    continuityPage(d),
    inspectionPage(d),
  )
  return renderToBuffer(doc) as Promise<Buffer>
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { caller, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
  }

  const { format } = parsed.data
  const admin      = createAdminClient()

  // Verify project belongs to org
  const { data: project, error: projErr } = await admin
    .from('projects')
    .select('id, name, governing_code, jurisdiction, ahj, unit_system, project_number')
    .eq('id', params.id)
    .eq('organization_id', caller.organization_id)
    .maybeSingle()

  if (projErr) return NextResponse.json({ error: projErr.message },  { status: 400 })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Fetch all compliance data in parallel
  const [weldsRes, inspectionsRes, qualsRes, continuityRes] = await Promise.all([
    admin
      .from('welds')
      .select('id, weld_id_number, welder_name, welder_stamp, weld_process, weld_date, status')
      .eq('project_id', params.id)
      .order('weld_id_number'),

    admin
      .from('weld_inspections')
      .select('id, weld_id, weld_id_number, inspection_type, result, performed_by, inspection_date, notes, created_at')
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),

    admin
      .from('welder_qualifications')
      .select('id, welder_name, welder_stamp, process, weld_process, expiry_date, expires_at, status')
      .eq('organization_id', caller.organization_id),

    admin
      .from('welder_continuity')
      .select('id, welder_name, welder_stamp, process, weld_process, last_weld_date, last_active, status')
      .eq('organization_id', caller.organization_id),
  ])

  const welds       = weldsRes.data       ?? []
  const inspections = inspectionsRes.data ?? []
  const qualifications = qualsRes.data    ?? []
  const continuity  = continuityRes.data  ?? []

  const inspectedCount  = inspections.filter((i) => i.result && i.result !== 'pending').length
  const inspection_pct  = welds.length > 0 ? (inspectedCount / welds.length) * 100 : 0
  const generated_at    = new Date().toISOString()

  const auditData: AuditData = {
    project:       project as unknown as Record<string, unknown>,
    welds:         welds   as unknown as Record<string, unknown>[],
    inspections:   inspections as unknown as Record<string, unknown>[],
    qualifications:qualifications as unknown as Record<string, unknown>[],
    continuity:    continuity as unknown as Record<string, unknown>[],
    generated_at,
    inspection_pct,
  }

  if (format === 'JSON') {
    return NextResponse.json({
      generated_at,
      project,
      weld_log: {
        total_welds:    welds.length,
        inspection_pct: Number(inspection_pct.toFixed(1)),
        welds,
      },
      welder_qualifications: qualifications,
      continuity_status:     continuity,
      inspection_findings:   inspections,
    })
  }

  // PDF
  try {
    const pdfBuffer = await buildPdf(auditData)
    const projectSlug = String(project.name ?? 'project').replace(/\s+/g, '-').toLowerCase()

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status:  200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="audit-pack-${projectSlug}-${generated_at.slice(0, 10)}.pdf"`,
        'Content-Length':      String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[audit-pack] PDF render error:', err)
    return NextResponse.json({ error: 'Failed to render PDF audit pack' }, { status: 500 })
  }
}

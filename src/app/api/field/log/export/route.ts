// GET /api/field/log/export?format=pdf|csv
//
// CRITICAL EXPORT RULE:
// This query reads ONLY from `personal_work_log`. It does NOT join to
// `organizations`, `clients`, `projects` (commercial columns), or any
// table containing pricing, contract, or commercial data.
// `project_name` is a denormalized TEXT snapshot stored directly in
// `personal_work_log` — no runtime JOIN to the projects table is needed.
//
// Two layers of protection:
//   1. Query: .from('personal_work_log').select('...') — no .select('projects(...)'),
//             no .select('organizations(...)'), no reference to clients/billing/pricing.
//   2. RLS: personal_log_select_own policy enforces auth_user_id = auth.uid() — even
//           if the query were modified, a user can only see their own rows.
//
// PDF note: @react-pdf/renderer is installed (package.json). We generate a
// print-optimised HTML document that the worker can print-to-PDF from the browser.
// This avoids the Node/Edge runtime constraints of react-pdf in Route Handlers.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { FLAGS } from '@/intelligence/flags'

// ── Helpers ───────────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return iso
  }
}

function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`
  } catch {
    return iso
  }
}

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function ndeLabel(result: string | null | undefined): string {
  if (!result) return ''
  if (result === 'pass') return 'Released'
  if (result === 'fail') return 'Failed'
  if (result === 'pending') return 'Pending'
  return result
}

// ── Row type from the query ───────────────────────────────────
interface LogRow {
  event_type:      string
  logged_at:       string
  project_name:    string | null
  joint_number:    string | null
  weld_process:    string | null
  welder_stamp:    string | null
  nde_result:      string | null
  nde_released_at: string | null
  note:            string | null
  source:          string
}

// ── GET ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!FLAGS.PFOS_FIELD_MODE || !FLAGS.PFOS_FIELD_PERSONAL_LOG) {
    return NextResponse.json({ error: 'Field personal log is not enabled' }, { status: 403 })
  }

  const { caller, error } = await requireAuth(req)
  if (error) return error

  if (!caller.organization_id) {
    return NextResponse.json({ error: 'No organization associated with this account' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'csv'

  if (format !== 'pdf' && format !== 'csv') {
    return NextResponse.json({ error: 'format must be pdf or csv' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── CRITICAL: reads ONLY from personal_work_log ──────────────
  // No JOIN to organizations, clients, projects, or any commercial table.
  // project_name is already a denormalized snapshot in personal_work_log.
  const { data, error: dbError } = await supabase
    .from('personal_work_log')
    .select(
      'event_type, logged_at, project_name, joint_number, weld_process, welder_stamp, nde_result, nde_released_at, note, source'
    )
    // Notice: NO .select('projects(name, client_id, ...)') join
    // Notice: NO .select('organizations(name)') join
    .eq('auth_user_id', caller.auth_user_id)
    .eq('organization_id', caller.organization_id)
    .order('logged_at', { ascending: false })

  if (dbError) {
    console.error('[field/log/export GET]', dbError)
    return NextResponse.json({ error: 'Failed to fetch log entries' }, { status: 500 })
  }

  const rows = (data ?? []) as LogRow[]
  const exportDate = new Date().toISOString().slice(0, 10)
  const workerName = caller.full_name ?? 'Worker'

  if (format === 'csv') {
    const header = 'Date,Event,Project,Joint,Process,Stamp,NDE Result,Note'
    const lines = rows.map(r =>
      [
        escapeCsv(formatDatetime(r.logged_at)),
        escapeCsv(r.event_type),
        escapeCsv(r.project_name),
        escapeCsv(r.joint_number),
        escapeCsv(r.weld_process),
        escapeCsv(r.welder_stamp),
        escapeCsv(ndeLabel(r.nde_result)),
        escapeCsv(r.note),
      ].join(',')
    )
    const csv = [header, ...lines].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="my-log-${exportDate}.csv"`,
      },
    })
  }

  // ── PDF via print-optimised HTML ─────────────────────────────
  // @react-pdf/renderer is installed but runs in a browser context.
  // Generating print-optimised HTML is the reliable server-side path.
  // The worker prints to PDF from the browser using Ctrl+P / Share > Print.
  const rowsHtml = rows
    .map(
      r => `
    <tr>
      <td>${formatDatetime(r.logged_at)}</td>
      <td>${r.event_type ?? ''}</td>
      <td>${r.project_name ?? ''}</td>
      <td>${r.joint_number ?? ''}</td>
      <td>${r.weld_process ?? ''}</td>
      <td>${r.welder_stamp ?? ''}</td>
      <td>${ndeLabel(r.nde_result)}</td>
      <td>${r.note ?? ''}</td>
    </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My Work Log — ${workerName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 20px; }
    h1 { font-size: 16px; margin-bottom: 2px; }
    .meta { font-size: 11px; color: #555; margin-bottom: 8px; }
    .disclaimer {
      border: 1px solid #aaa;
      padding: 8px 12px;
      margin-bottom: 16px;
      font-size: 10px;
      color: #444;
      background: #f9f9f9;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #eee; font-weight: bold; }
    tr:nth-child(even) { background: #f5f5f5; }
    @media print {
      body { margin: 10mm; }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>MY WORK LOG — ${workerName}</h1>
  <div class="meta">Exported: ${exportDate}</div>
  <div class="disclaimer">
    This export contains only your own entries. It does not include client names,
    commercial data, other workers' entries, or pricing information.
  </div>
  <p class="no-print" style="color:#555;font-size:11px;">
    To save as PDF: use your browser's Print function (Ctrl+P / Cmd+P) and choose "Save as PDF".
  </p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Event</th>
        <th>Project</th>
        <th>Joint</th>
        <th>Process</th>
        <th>Stamp</th>
        <th>NDE Result</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#888;">No entries</td></tr>'}
    </tbody>
  </table>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="my-log-${exportDate}.html"`,
    },
  })
}

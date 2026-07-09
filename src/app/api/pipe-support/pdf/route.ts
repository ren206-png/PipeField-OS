// POST /api/pipe-support/pdf
// Body: { calculation_id?: string } | { inputs, result, name }
// Returns a PDF calculation sheet for a pipe support result.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import React from 'react'

const pdfSchema = z.object({
  calculation_id: z.string().uuid().optional(),
  name:           z.string().max(200).optional(),
})

// ── Styles ─────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    backgroundColor: '#ffffff',
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#f97316',
    paddingBottom: 12,
    marginBottom: 20,
  },
  headerTitle: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: '#f97316' },
  headerSub:   { fontSize: 8, color: '#64748b', marginTop: 2 },
  headerRight: { textAlign: 'right', fontSize: 8, color: '#64748b' },
  sectionWrap: { marginBottom: 16 },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 10,
    color: '#f97316', borderBottomWidth: 1,
    borderBottomColor: '#fed7aa', paddingBottom: 3, marginBottom: 6,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0',
  },
  label: { color: '#64748b', flex: 1 },
  value: { fontFamily: 'Helvetica-Bold', flex: 1, textAlign: 'right' },
  notice: {
    marginTop: 24, padding: 8, backgroundColor: '#fff7ed',
    borderLeftWidth: 3, borderLeftColor: '#f97316',
  },
  noticeText: { fontSize: 7, color: '#92400e', lineHeight: 1.4 },
  footer: {
    position: 'absolute', bottom: 24, left: 48, right: 48,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7, color: '#94a3b8',
  },
})

// Pure inline helpers (no custom component types — avoids createElement overload errors)
function row(label: string, value: string) {
  return React.createElement(View, { style: S.row, key: label },
    React.createElement(Text, { style: S.label }, label),
    React.createElement(Text, { style: S.value }, value),
  )
}

function section(title: string, ...rows: React.ReactElement[]) {
  return React.createElement(View, { style: S.sectionWrap },
    React.createElement(Text, { style: S.sectionTitle }, title),
    ...rows,
  )
}

function buildPdf(calcName: string, inputs: Record<string, unknown>, result: Record<string, unknown>) {
  const now = new Date().toLocaleString()
  const dims         = result.dimensions   as Record<string, number> | undefined
  const weights      = result.weights      as Record<string, number> | undefined
  const span         = result.span         as Record<string, number> | undefined
  const ht           = result.hydrotest    as Record<string, number> | undefined
  const wc           = result.weld_clearance as { pass: boolean; conflicts: unknown[] } | undefined

  const children: React.ReactElement[] = []

  // Header
  children.push(
    React.createElement(View, { style: S.header, key: 'hdr' },
      React.createElement(View, { key: 'hl' },
        React.createElement(Text, { style: S.headerTitle }, 'PIPE SUPPORT CALCULATION'),
        React.createElement(Text, { style: S.headerSub }, calcName),
      ),
      React.createElement(View, { style: S.headerRight, key: 'hr' },
        React.createElement(Text, null, `Generated: ${now}`),
        React.createElement(Text, null, 'PipeField OS'),
        React.createElement(Text, null, 'ASME B31.3 / MSS SP-58 / MSS SP-69'),
      ),
    )
  )

  // 1. Inputs
  children.push(section('1. INPUT PARAMETERS',
    row('NPS (in)',         String(inputs.nps          ?? '—')),
    row('Schedule',         String(inputs.schedule     ?? '—')),
    row('Material',         String(inputs.material     ?? '—')),
    row('Fluid',            String(inputs.fluid        ?? '—')),
    row('Design Basis',     String(inputs.design_basis ?? '—')),
    row('Support Type',     String(inputs.support_type ?? '—').replace(/_/g, ' ')),
    row('Insulation (in)',  String(inputs.insulation_thickness_in ?? '0')),
  ))

  // 2. Dimensions
  if (dims) {
    children.push(section('2. PIPE DIMENSIONS',
      row('OD (in)',             dims.OD_in?.toFixed(4)   ?? '—'),
      row('Wall Thickness (in)', dims.wall_in?.toFixed(4) ?? '—'),
      row('ID (in)',             dims.ID_in?.toFixed(4)   ?? '—'),
    ))
  }

  // 3. Weights
  if (weights) {
    children.push(section('3. WEIGHT SUMMARY (lb/ft)',
      row('Pipe Metal',  weights.metal_lbft?.toFixed(2)      ?? '—'),
      row('Fluid',       weights.fluid_lbft?.toFixed(2)      ?? '—'),
      row('Insulation',  weights.insulation_lbft?.toFixed(2) ?? '—'),
      row('TOTAL',       weights.total_lbft?.toFixed(2)      ?? '—'),
    ))
  }

  // 4. Span
  if (span) {
    children.push(section('4. SUPPORT SPAN (MSS SP-69)',
      row('Calculated Max Span (ft)',    span.calculated_ft?.toFixed(2)          ?? '—'),
      row('MSS SP-69 Recommended (ft)',  span.recommended_ft?.toFixed(1)         ?? '—'),
      row('SELECTED Span (ft)',          span.selected_ft?.toFixed(1)            ?? '—'),
      row('Moment of Inertia (in⁴)', span.moment_of_inertia_in4?.toFixed(4) ?? '—'),
    ))
  }

  // 5. Hydrotest
  if (ht) {
    children.push(section('5. HYDROTEST LOADING (ASME B31.3 §345.4)',
      row('Water Weight (lb/ft)',          ht.W_water_lbft?.toFixed(2)      ?? '—'),
      row('Test Weight (lb/ft)',           ht.W_test_lbft?.toFixed(2)       ?? '—'),
      row('Test Load on Support (lb)',     ht.P_test_lb?.toFixed(1)         ?? '—'),
      row('% Increase vs Operating',       `${ht.percent_increase?.toFixed(1) ?? '—'}%`),
    ))
  }

  // 6. Weld clearance
  if (wc) {
    children.push(section('6. WELD CLEARANCE CHECK (ASME B31.3 §328.4)',
      row('Status', wc.pass
        ? 'PASS — All supports clear of welds'
        : `CONFLICTS FOUND — ${wc.conflicts.length} support(s) shifted`),
    ))
  }

  // Engineering notice
  children.push(
    React.createElement(View, { style: S.notice, key: 'notice' },
      React.createElement(Text, { style: S.noticeText },
        'ENGINEERING NOTICE: This calculation sheet is produced by PipeField OS for reference only. ' +
        'All values must be verified against current editions of ASME B31.3, MSS SP-58, and project-specific ' +
        'engineering specifications before use in fabrication or construction. This document does not replace ' +
        'review by a licensed Professional Engineer where required by code, regulation, or project contract.'
      ),
    )
  )

  // Footer
  children.push(
    React.createElement(View, { style: S.footer, fixed: true, key: 'footer' },
      React.createElement(Text, null, 'PipeField OS — Pipe Support Calculation'),
      React.createElement(Text, {
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`,
      }),
    )
  )

  return React.createElement(Document, { title: `Pipe Support — ${calcName}` },
    React.createElement(Page, { size: 'A4', style: S.page }, ...children)
  )
}

// ── Route handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth — get user and org for IDOR scoping
    const { caller, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!caller.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const rawBody = await req.json()

    // Zod validation
    const parsed = pdfSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    let calcName = (rawBody.name as string | undefined) ?? 'Pipe Support Calculation'
    let inputs:  Record<string, unknown> = (rawBody.inputs  as Record<string, unknown> | undefined) ?? {}
    let result:  Record<string, unknown> = (rawBody.result  as Record<string, unknown> | undefined) ?? {}

    // Allow fetching by saved ID — scoped to org to prevent IDOR
    if (parsed.data.calculation_id) {
      const { data, error } = await supabase
        .from('pipe_support_calculations')
        .select('*')
        .eq('id', parsed.data.calculation_id)
        .eq('organization_id', caller.organization_id)
        .maybeSingle()
      if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      calcName = data.name as string
      inputs   = data.inputs as Record<string, unknown>
      result   = data.result as Record<string, unknown>
    }

    const doc    = buildPdf(calcName, inputs, result)
    const buffer = await renderToBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="pipe-support-${Date.now()}.pdf"`,
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

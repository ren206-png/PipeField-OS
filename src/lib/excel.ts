import ExcelJS from 'exceljs'

// ── Weld Log template columns (order matters for import matching) ──
export const WELD_LOG_COLUMNS = [
  { header: 'Weld Number',       key: 'weld_number',         width: 16 },
  { header: 'Joint Type',        key: 'joint_type',          width: 14 },
  { header: 'Size (in)',         key: 'size_inches',         width: 10 },
  { header: 'Wall Thickness',    key: 'wall_thickness',      width: 14 },
  { header: 'Process',           key: 'process',             width: 12 },
  { header: 'Position',          key: 'position',            width: 12 },
  { header: 'Welder Stamp',      key: 'welder_stamp',        width: 14 },
  { header: 'WPS Number',        key: 'wps_number',          width: 14 },
  { header: 'Date',              key: 'weld_date',           width: 12 },
  { header: 'Heat A',            key: 'base_metal_heat_a',   width: 14 },
  { header: 'Heat B',            key: 'base_metal_heat_b',   width: 14 },
  { header: 'Filler Batch',      key: 'filler_batch_number', width: 14 },
  { header: 'Status',            key: 'status',              width: 12 },
  { header: 'Notes',             key: 'notes',               width: 30 },
] as const

// ── Welder Roster template columns ──
export const WELDER_ROSTER_COLUMNS = [
  { header: 'Stamp',             key: 'stamp',               width: 12 },
  { header: 'First Name',        key: 'first_name',          width: 16 },
  { header: 'Last Name',         key: 'last_name',           width: 16 },
  { header: 'Cert Expiry',       key: 'cert_expiry',         width: 14 },
  { header: 'Process',           key: 'process',             width: 12 },
  { header: 'Position',          key: 'position',            width: 12 },
  { header: 'WPS Numbers',       key: 'wps_numbers',         width: 24 },
] as const

// ── MTR Index template columns ──
export const MTR_COLUMNS = [
  { header: 'Heat Number',       key: 'heat_number',         width: 18 },
  { header: 'Material',          key: 'material_spec',       width: 20 },
  { header: 'Grade',             key: 'grade',               width: 12 },
  { header: 'Cert Status',       key: 'cert_status',         width: 14 },
  { header: 'Supplier',          key: 'supplier',            width: 20 },
  { header: 'PO Number',         key: 'po_number',           width: 16 },
  { header: 'Received Date',     key: 'received_date',       width: 14 },
  { header: 'Notes',             key: 'notes',               width: 30 },
] as const

export async function buildWeldLogWorkbook(rows: Record<string, unknown>[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PipeField OS'
  const ws = wb.addWorksheet('Weld Log')
  ws.columns = WELD_LOG_COLUMNS.map(c => ({ ...c }))
  // Header row styling
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  rows.forEach(r => ws.addRow(r))
  return wb.xlsx.writeBuffer()
}

export async function buildWelderRosterWorkbook(rows: Record<string, unknown>[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PipeField OS'
  const ws = wb.addWorksheet('Welder Roster')
  ws.columns = WELDER_ROSTER_COLUMNS.map(c => ({ ...c }))
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  rows.forEach(r => ws.addRow(r))
  return wb.xlsx.writeBuffer()
}

export async function buildMtrWorkbook(rows: Record<string, unknown>[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PipeField OS'
  const ws = wb.addWorksheet('MTR Index')
  ws.columns = MTR_COLUMNS.map(c => ({ ...c }))
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  rows.forEach(r => ws.addRow(r))
  return wb.xlsx.writeBuffer()
}

// Parse uploaded Excel file — returns { headers, rows }
export async function parseWorkbook(buffer: any): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('No worksheet found in uploaded file')
  const headers: string[] = []
  ws.getRow(1).eachCell(cell => headers.push(String(cell.value ?? '').trim()))
  const rows: Record<string, string>[] = []
  ws.eachRow((row, idx) => {
    if (idx === 1) return
    const r: Record<string, string> = {}
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1)
      r[h] = cell.value != null ? String(cell.value).trim() : ''
    })
    if (Object.values(r).some(v => v !== '')) rows.push(r)
  })
  return { headers, rows }
}

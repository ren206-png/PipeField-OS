#!/usr/bin/env tsx
// ============================================================
// Field Mode Phase 1 — generic reference-data importer.
//
// Reads every CSV under /data/sources/recall and
// /data/sources/pocket-tradesman, Zod-validates each row, writes it
// to the matching public.ref_* table via the service-role client
// (lib/supabase.ts — NOT createAdminClient, see that file's header
// comment for why this satisfies the Definition of Done), and:
//   - rejects rows missing source_doc or verified (master prompt §3.3)
//   - computes source_file_sha256 per file
//   - is idempotent: same file hash already present for that
//     table/source -> no-op
//   - supersedes (never edits) on file change: old batch's rows get
//     superseded_by_batch set to the new batch id; new rows are
//     inserted fresh
//   - re-runs the batch-1 validation-report checks (lib/checks.ts)
//     against ref_flanges / ref_bw_fittings as importer assertions;
//     an unlisted violation blocks import of THAT table only
//   - applies the generic book_note rejection rule (any pocket row
//     with a non-empty book_note column imports with rejected=true)
//   - runs the precedence.ts reconciliation pass after all files are
//     imported, marking specific recall rows superseded_by_batch per
//     the owner-approved cross-check document
//   - writes scripts/field-mode/logs/IMPORT_LOG_<table>.md per table
//
// Usage:
//   npx tsx scripts/field-mode/import-reference-data.ts --dry-run
//   npx tsx scripts/field-mode/import-reference-data.ts
//   npx tsx scripts/field-mode/import-reference-data.ts --table ref_flanges
//
// --dry-run performs CSV parsing, Zod validation, batch-1 checks,
// and precedence-key resolution WITHOUT touching the database. Use
// it to validate all 41 source files before the migration has been
// applied, or to sanity-check a source-file edit before a real run.
// ============================================================
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { parseCsv } from './lib/csv'
import { inferColumns, ColumnDef, PgType } from './lib/schema-infer'
import { allFileTablePairs } from './lib/table-map'
import { sha256File } from './lib/hash'
import { getServiceClient } from './lib/supabase'
import { runBatch1Checks, CheckRow, CheckViolation } from './lib/checks'
import { findInMmPairs, checkAndRecomputeUnits } from './lib/units-check'
import {
  STUD_LENGTH_SUPERSESSIONS,
  FLANGE_BOLT_OD_MISPRINTS,
  TEE_OUTLET_SUPERSESSIONS,
  SHACKLE_SUPERSESSIONS,
  WN_LTH_EXPECTED_MISMATCH_COUNT,
} from './lib/precedence'

const ROOT = path.resolve(__dirname, '..', '..')
const RECALL_DIR = path.join(ROOT, 'data', 'sources', 'recall')
const POCKET_DIR = path.join(ROOT, 'data', 'sources', 'pocket-tradesman')
const LOG_DIR = path.join(ROOT, 'scripts', 'field-mode', 'logs')

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const ONLY_TABLE = (() => {
  const i = argv.indexOf('--table')
  return i >= 0 ? argv[i + 1] : null
})()

// ------------------------------------------------------------
// Per-file Zod schema, built from inferred columns. Validates the
// RAW csv row (keyed by csvHeader, all string values). Every column
// is optional/nullable EXCEPT source_doc and verified, which the
// master prompt names explicitly as required.
// ------------------------------------------------------------
function buildRowSchema(cols: ColumnDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const col of cols) {
    if (col.pgType === 'BOOLEAN') {
      shape[col.csvHeader] = z
        .union([z.literal('true'), z.literal('false'), z.literal('')])
        .optional()
        .default('')
    } else if (col.pgType === 'NUMERIC') {
      shape[col.csvHeader] = z
        .string()
        .optional()
        .default('')
        .refine((v) => v === '' || /^-?\d+(\.\d+)?$/.test(v.trim()), {
          message: `must be a plain decimal or empty`,
        })
    } else {
      shape[col.csvHeader] = z.string().optional().default('')
    }
  }
  // Required, per master prompt §3.3 — overrides the generic entry above.
  shape['source_doc'] = z.string().min(1, 'source_doc is required')
  shape['verified'] = z.union([z.literal('true'), z.literal('false')], {
    errorMap: () => ({ message: 'verified is required and must be true/false' }),
  })
  return z.object(shape).passthrough()
}

function toDbRow(csvRow: Record<string, string>, cols: ColumnDef[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const col of cols) {
    const raw = csvRow[col.csvHeader]
    if (raw === undefined || raw === '') {
      out[col.dbColumn] = null
      continue
    }
    if (col.pgType === 'BOOLEAN') out[col.dbColumn] = raw.trim() === 'true'
    else if (col.pgType === 'NUMERIC') out[col.dbColumn] = Number(raw)
    else out[col.dbColumn] = raw
  }
  return out
}

interface ImportResult {
  table: string
  file: string
  source: 'recall' | 'pocket-tradesman'
  status: 'imported' | 'no-op' | 'blocked' | 'error'
  batchId?: string
  fileHash: string
  totalRows: number
  acceptedRows: number
  rejectedByValidation: { rowIndex: number; reasons: string[] }[]
  rejectedByBookNote: number
  checkViolations: CheckViolation[]
  errorMessage?: string
  supersededPriorRows: number
}

async function importFile(
  file: string,
  table: string,
  source: 'recall' | 'pocket-tradesman'
): Promise<ImportResult> {
  const dir = source === 'recall' ? RECALL_DIR : POCKET_DIR
  const full = path.join(dir, file)
  const buf = fs.readFileSync(full)
  const fileHash = sha256File(buf)
  const text = buf.toString('utf8')
  const csv = parseCsv(text)
  const cols = inferColumns(csv)
  const schema = buildRowSchema(cols)

  const result: ImportResult = {
    table,
    file,
    source,
    status: 'imported',
    fileHash,
    totalRows: csv.rows.length,
    acceptedRows: 0,
    rejectedByValidation: [],
    rejectedByBookNote: 0,
    checkViolations: [],
    supersededPriorRows: 0,
  }

  const client = DRY_RUN ? null : getServiceClient()

  // --- Idempotency check ---
  if (!DRY_RUN && client) {
    const { data: sameHash, error } = await client
      .from(table)
      .select('id')
      .eq('source_file_sha256', fileHash)
      .limit(1)
    if (error) {
      result.status = 'error'
      result.errorMessage = `idempotency check failed: ${error.message}`
      return result
    }
    if (sameHash && sameHash.length > 0) {
      result.status = 'no-op'
      return result
    }
  }

  // --- Validate every row; build DB-ready rows for the ones that pass ---
  const unitPairs = findInMmPairs(cols)
  const validRows: { csvRow: Record<string, string>; dbRow: Record<string, any> }[] = []
  csv.rows.forEach((row, idx) => {
    const parsed = schema.safeParse(row)
    if (!parsed.success) {
      result.rejectedByValidation.push({
        rowIndex: idx,
        reasons: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      })
      return
    }

    // Inch/mm recompute-and-compare (master prompt rule 5). A row
    // whose CSV-supplied mm disagrees with mm recomputed from the
    // inch value of record is rejected, not silently imported.
    const unitCheck = checkAndRecomputeUnits(row, unitPairs)
    if (unitCheck.reasons.length > 0) {
      result.rejectedByValidation.push({ rowIndex: idx, reasons: unitCheck.reasons })
      return
    }

    const dbRow = toDbRow(row, cols)
    // Overwrite CSV-supplied mm with the importer's own recomputed
    // value so the conversion is auditable, per rule 5.
    for (const [col, val] of Object.entries(unitCheck.recomputedMm)) dbRow[col] = val

    // Generic book_note rejection rule (master prompt cross-check
    // follow-up, documented in precedence.ts trailing comment): any
    // pocket row with a non-empty book_note imports with rejected=true.
    let rejected = dbRow.rejected === true // CSV never actually supplies this; stays false unless set below
    let rejectedNote: string | null = dbRow.rejected_note ?? null
    if ('book_note' in dbRow && dbRow.book_note) {
      rejected = true
      rejectedNote = `book_note: ${dbRow.book_note}`
      result.rejectedByBookNote += 1
    }
    dbRow.rejected = rejected
    dbRow.rejected_note = rejectedNote

    if (!('recall_confidence' in dbRow) || dbRow.recall_confidence === null) {
      dbRow.recall_confidence = 'unrated'
    }

    validRows.push({ csvRow: row, dbRow })
  })
  result.acceptedRows = validRows.length

  // --- Batch-1 internal-consistency checks (block THIS table only) ---
  if (table === 'ref_flanges') {
    result.checkViolations = runBatch1Checks(
      validRows.map((r) => r.csvRow as CheckRow),
      []
    )
  } else if (table === 'ref_bw_fittings') {
    result.checkViolations = runBatch1Checks([], validRows.map((r) => r.csvRow as CheckRow))
  }
  if (result.checkViolations.length > 0) {
    result.status = 'blocked'
    return result
  }

  if (DRY_RUN) {
    result.batchId = '(dry-run — no batch id assigned)'
    return result
  }

  const batchId = randomUUID()
  result.batchId = batchId

  // --- Supersede prior un-superseded rows for this table/source, if any ---
  const { data: existingRows, error: existingErr } = await client!
    .from(table)
    .select('id, import_batch_id')
    .eq('source_dir', source)
    .is('superseded_by_batch', null)
  if (existingErr) {
    result.status = 'error'
    result.errorMessage = `existing-rows lookup failed: ${existingErr.message}`
    return result
  }
  if (existingRows && existingRows.length > 0) {
    const { error: supersedeErr } = await client!
      .from(table)
      .update({ superseded_by_batch: batchId })
      .eq('source_dir', source)
      .is('superseded_by_batch', null)
    if (supersedeErr) {
      result.status = 'error'
      result.errorMessage = `supersede update failed: ${supersedeErr.message}`
      return result
    }
    result.supersededPriorRows = existingRows.length
  }

  // --- Insert new batch ---
  const now = new Date().toISOString()
  const insertRows = validRows.map(({ dbRow }) => ({
    ...dbRow,
    source_page_or_table: dbRow.source_page_or_table ?? null,
    verified_at: dbRow.verified === true ? now : null,
    import_batch_id: batchId,
    imported_at: now,
    source_file_sha256: fileHash,
    source_dir: source,
  }))

  const CHUNK = 500
  for (let i = 0; i < insertRows.length; i += CHUNK) {
    const chunk = insertRows.slice(i, i + CHUNK)
    const { error: insertErr } = await client!.from(table).insert(chunk)
    if (insertErr) {
      result.status = 'error'
      result.errorMessage = `insert failed at rows ${i}-${i + chunk.length}: ${insertErr.message}`
      return result
    }
  }

  return result
}

function writeImportLog(result: ImportResult) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const lines: string[] = []
  lines.push(`# IMPORT_LOG_${result.table}`)
  lines.push('')
  lines.push(`- Source file: \`data/sources/${result.source}/${result.file}\``)
  lines.push(`- File SHA-256: \`${result.fileHash}\``)
  lines.push(`- Run at: ${new Date().toISOString()}${DRY_RUN ? ' (DRY RUN — no DB writes)' : ''}`)
  lines.push(`- Status: **${result.status}**`)
  if (result.batchId) lines.push(`- import_batch_id: \`${result.batchId}\``)
  lines.push(`- Total CSV rows: ${result.totalRows}`)
  lines.push(`- Accepted (passed validation): ${result.acceptedRows}`)
  lines.push(`- Rejected by validation: ${result.rejectedByValidation.length}`)
  lines.push(`- Rejected via book_note (rejected=true, row still imported): ${result.rejectedByBookNote}`)
  lines.push(`- Prior rows superseded: ${result.supersededPriorRows}`)
  if (result.errorMessage) lines.push(`- Error: ${result.errorMessage}`)
  lines.push('')

  if (result.rejectedByValidation.length > 0) {
    lines.push('## Rows rejected by validation')
    lines.push('')
    for (const r of result.rejectedByValidation) {
      lines.push(`- Row ${r.rowIndex} (0-based, header excluded): ${r.reasons.join('; ')}`)
    }
    lines.push('')
  }

  if (result.checkViolations.length > 0) {
    lines.push('## Consistency-check violations (import BLOCKED for this table)')
    lines.push('')
    for (const v of result.checkViolations) {
      lines.push(`- ${v.message}`)
    }
    lines.push('')
  }

  const outPath = path.join(LOG_DIR, `IMPORT_LOG_${result.table}.md`)
  fs.writeFileSync(outPath, lines.join('\n') + '\n')
}

// ------------------------------------------------------------
// Precedence reconciliation pass — runs after all 41 files have
// been imported. Every value compared below is transcribed in
// lib/precedence.ts directly from CROSS_CHECK_pocket_tradesman.md.
// A recall value that does not match what precedence.ts expects is
// a NEW discrepancy, not a known one — the reconciliation aborts
// loudly for that entry rather than superseding the wrong row.
// ------------------------------------------------------------
interface ReconciliationLog {
  lines: string[]
}

async function fetchOne(
  client: ReturnType<typeof getServiceClient>,
  table: string,
  match: Record<string, any>
) {
  let q = client.from(table).select('*').is('superseded_by_batch', null)
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v)
  const { data, error } = await q.limit(2)
  if (error) throw new Error(`lookup on ${table} failed: ${error.message}`)
  if (!data || data.length === 0) return null
  if (data.length > 1) throw new Error(`ambiguous lookup on ${table} for ${JSON.stringify(match)} (${data.length} rows)`)
  return data[0]
}

async function runPrecedenceReconciliation(rlog: ReconciliationLog) {
  if (DRY_RUN) {
    rlog.lines.push('DRY RUN — precedence reconciliation skipped (no DB to query).')
    return
  }
  const client = getServiceClient()
  const reconBatch = randomUUID()
  rlog.lines.push(`Reconciliation batch id: ${reconBatch}`)
  rlog.lines.push('')

  // 1. Stud length supersessions
  rlog.lines.push('## Stud length (ref_stud_bolts -> ref_flange_bolting_book)')
  for (const e of STUD_LENGTH_SUPERSESSIONS) {
    const recallRow = await fetchOne(client, 'ref_stud_bolts', { flange_class: e.flangeClass, nps: e.nps })
    const bookRow = await fetchOne(client, 'ref_flange_bolting_book', { flange_class: e.flangeClass, nps: e.nps })
    if (!recallRow || !bookRow) {
      rlog.lines.push(`- SKIP class ${e.flangeClass} NPS ${e.nps}: row missing (recall=${!!recallRow}, book=${!!bookRow})`)
      continue
    }
    if (recallRow.stud_length_in !== e.recallValue) {
      throw new Error(
        `Stud length sanity check failed: class ${e.flangeClass} NPS ${e.nps} recall stud_length_in is "${recallRow.stud_length_in}", expected "${e.recallValue}" per precedence.ts. Aborting reconciliation — this is a NEW discrepancy, not superseding blindly.`
      )
    }
    await client.from('ref_stud_bolts').update({ superseded_by_batch: reconBatch }).eq('id', recallRow.id)
    rlog.lines.push(`- class ${e.flangeClass} NPS ${e.nps}: recall "${e.recallValue}" superseded by book "${e.bookValue}"`)
  }

  // 2. Flange bolt/OD misprints — book row gets rejected=true
  rlog.lines.push('')
  rlog.lines.push('## Flange bolt/OD misprints (ref_flange_bolting_book rows flagged rejected)')
  for (const e of FLANGE_BOLT_OD_MISPRINTS) {
    const bookRow = await fetchOne(client, 'ref_flange_bolting_book', { flange_class: e.flangeClass, nps: e.nps })
    if (!bookRow) {
      rlog.lines.push(`- SKIP class ${e.flangeClass} NPS ${e.nps}: book row missing`)
      continue
    }
    await client
      .from('ref_flange_bolting_book')
      .update({ rejected: true, rejected_note: e.note })
      .eq('id', bookRow.id)
    rlog.lines.push(`- class ${e.flangeClass} NPS ${e.nps}: book row flagged rejected — ${e.note}`)
  }

  // 3. Reducing tee outlet supersessions
  rlog.lines.push('')
  rlog.lines.push('## Reducing tee outlet (ref_reducing_tee_outlets -> ref_reducing_tee_outlets_book)')
  for (const e of TEE_OUTLET_SUPERSESSIONS) {
    const recallRow = await fetchOne(client, 'ref_reducing_tee_outlets', { run_nps: e.runNps, outlet_nps: e.outletNps })
    const bookRow = await fetchOne(client, 'ref_reducing_tee_outlets_book', { run_nps: e.runNps, outlet_nps: e.outletNps })
    if (!recallRow || !bookRow) {
      rlog.lines.push(`- SKIP run ${e.runNps} x outlet ${e.outletNps}: row missing (recall=${!!recallRow}, book=${!!bookRow})`)
      continue
    }
    if (String(recallRow.outlet_center_to_end_m_in) !== e.recallValueIn) {
      throw new Error(
        `Tee outlet sanity check failed: run ${e.runNps} x outlet ${e.outletNps} recall outlet_center_to_end_m_in is "${recallRow.outlet_center_to_end_m_in}", expected "${e.recallValueIn}". Aborting.`
      )
    }
    await client.from('ref_reducing_tee_outlets').update({ superseded_by_batch: reconBatch }).eq('id', recallRow.id)
    rlog.lines.push(`- run ${e.runNps} x outlet ${e.outletNps}: recall "${e.recallValueIn}" superseded by book "${e.bookValueIn}" (${e.bookValueMm} mm)`)
  }

  // 4. Shackle supersessions
  rlog.lines.push('')
  rlog.lines.push('## Shackles (ref_shackles -> ref_shackles_book)')
  for (const e of SHACKLE_SUPERSESSIONS) {
    const recallRow = await fetchOne(client, 'ref_shackles', { bow_size_in: e.bowSizeIn })
    const bookRow = await fetchOne(client, 'ref_shackles_book', { bow_size_in: e.bowSizeIn })
    if (!recallRow || !bookRow) {
      rlog.lines.push(`- SKIP bow ${e.bowSizeIn}: row missing (recall=${!!recallRow}, book=${!!bookRow})`)
      continue
    }
    if (String(recallRow.inside_width_at_pin_in) !== e.recallJawIn) {
      throw new Error(
        `Shackle sanity check failed: bow ${e.bowSizeIn} recall inside_width_at_pin_in is "${recallRow.inside_width_at_pin_in}", expected "${e.recallJawIn}". Aborting.`
      )
    }
    await client.from('ref_shackles').update({ superseded_by_batch: reconBatch }).eq('id', recallRow.id)
    rlog.lines.push(`- bow ${e.bowSizeIn}: recall "${e.recallJawIn}" superseded by book "${e.bookJawIn}" (${e.note})`)
  }

  // 5. WN LTH confirmation-only comparison
  //
  // CROSS_CHECK_pocket_tradesman.md's own claim is "40 match within
  // 3 mm, 0 differ" — a tolerance comparison, not exact equality.
  // ref_flanges.lth_wn_in/_mm is B16.5's weld-neck length through
  // hub WITHOUT raised face; ref_wn_flange_lth_book's column is
  // explicitly named lth_wn_incl_rf_* ("including raised face") — a
  // different quantity by definition, per its own header text
  // ("weld-neck length through hub INCLUDING raised face"). An
  // earlier version of this check compared the two directly with
  // strict string equality on the inch columns, which both ignored
  // the tolerance and compared mismatched quantities — it happened
  // to never fire during --dry-run because dry-run never reaches
  // this reconciliation pass (only a real run does), so this bug was
  // only caught on the first real import against production. Fixed
  // here to add ref_flanges.rf_height_in (converted to mm) to the
  // recall side before comparing to the book's mm value, within the
  // document's own stated 3 mm tolerance.
  rlog.lines.push('')
  rlog.lines.push(
    '## Weld-neck LTH confirmation (ref_flanges.lth_wn_mm + rf_height_in vs ref_wn_flange_lth_book.lth_wn_incl_rf_mm, 3mm tolerance)'
  )
  const { data: recallFlanges, error: rfErr } = await client
    .from('ref_flanges')
    .select('flange_class, nps, lth_wn_mm, rf_height_in')
    .is('superseded_by_batch', null)
  if (rfErr) throw new Error(`WN LTH lookup failed: ${rfErr.message}`)
  const { data: bookLth, error: blErr } = await client
    .from('ref_wn_flange_lth_book')
    .select('flange_class, nps, lth_wn_incl_rf_mm')
    .is('superseded_by_batch', null)
  if (blErr) throw new Error(`WN LTH book lookup failed: ${blErr.message}`)
  const WN_LTH_TOLERANCE_MM = 3
  let mismatches = 0
  const mismatchDetails: string[] = []
  const bookByKey = new Map((bookLth ?? []).map((r: any) => [`${r.flange_class}|${r.nps}`, r]))
  for (const r of recallFlanges ?? []) {
    const key = `${(r as any).flange_class}|${(r as any).nps}`
    const b = bookByKey.get(key)
    if (!b) continue
    const recallAdjustedMm = Number((r as any).lth_wn_mm) + Number((r as any).rf_height_in) * 25.4
    const bookMm = Number((b as any).lth_wn_incl_rf_mm)
    const diff = Math.abs(recallAdjustedMm - bookMm)
    if (diff > WN_LTH_TOLERANCE_MM) {
      mismatches += 1
      mismatchDetails.push(
        `${key}: recall ${recallAdjustedMm.toFixed(2)} mm (incl. RF) vs book ${bookMm} mm, diff ${diff.toFixed(2)} mm`
      )
    }
  }
  if (mismatches !== WN_LTH_EXPECTED_MISMATCH_COUNT) {
    throw new Error(
      `WN LTH confirmation failed: found ${mismatches} mismatches beyond ${WN_LTH_TOLERANCE_MM}mm tolerance, expected ${WN_LTH_EXPECTED_MISMATCH_COUNT} per precedence.ts. Details: ${mismatchDetails.join('; ')}. This is a NEW discrepancy not covered by the cross-check document — blocking rather than silently accepting.`
    )
  }
  rlog.lines.push(
    `- Confirmed: ${mismatches} mismatches beyond ${WN_LTH_TOLERANCE_MM}mm tolerance (expected ${WN_LTH_EXPECTED_MISMATCH_COUNT}). No rows changed.`
  )
  if (mismatchDetails.length > 0) rlog.lines.push(...mismatchDetails.map((d) => `  - ${d}`))
}

async function main() {
  const pairs = allFileTablePairs().filter((p) => !ONLY_TABLE || p.table === ONLY_TABLE)
  if (pairs.length === 0) {
    console.error(`No file/table pair matches --table ${ONLY_TABLE}`)
    process.exit(1)
  }

  console.log(`Field Mode importer — ${pairs.length} file(s)${DRY_RUN ? ' [DRY RUN]' : ''}`)
  const results: ImportResult[] = []
  for (const { file, table, source } of pairs) {
    process.stdout.write(`  ${table} <- ${source}/${file} ... `)
    try {
      const result = await importFile(file, table, source)
      results.push(result)
      writeImportLog(result)
      console.log(result.status)
    } catch (e: any) {
      console.log('error')
      console.error(`    ${e.message}`)
    }
  }

  // Only run reconciliation if a full run (not filtered to a single
  // unrelated table) and nothing was blocked/errored.
  const anyBlockedOrErrored = results.some((r) => r.status === 'blocked' || r.status === 'error')
  if (!ONLY_TABLE && !anyBlockedOrErrored) {
    console.log('\nRunning precedence reconciliation pass...')
    const rlog: ReconciliationLog = { lines: [] }
    try {
      await runPrecedenceReconciliation(rlog)
      console.log('  done')
    } catch (e: any) {
      rlog.lines.push('')
      rlog.lines.push(`ABORTED: ${e.message}`)
      console.error(`  ABORTED: ${e.message}`)
    }
    fs.mkdirSync(LOG_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(LOG_DIR, 'IMPORT_LOG_precedence_reconciliation.md'),
      `# IMPORT_LOG_precedence_reconciliation\n\nRun at: ${new Date().toISOString()}${DRY_RUN ? ' (DRY RUN)' : ''}\n\n` +
        rlog.lines.join('\n') +
        '\n'
    )
  } else if (!ONLY_TABLE) {
    console.log('\nSkipping precedence reconciliation: at least one table was blocked or errored.')
  }

  const blocked = results.filter((r) => r.status === 'blocked')
  const errored = results.filter((r) => r.status === 'error')
  console.log(`\nDone. imported=${results.filter((r) => r.status === 'imported').length} no-op=${results.filter((r) => r.status === 'no-op').length} blocked=${blocked.length} error=${errored.length}`)
  if (blocked.length > 0 || errored.length > 0) process.exitCode = 1
}

main()

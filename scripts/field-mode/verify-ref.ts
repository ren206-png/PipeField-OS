#!/usr/bin/env tsx
// ============================================================
// Field Mode Phase 1 — verify-ref CLI (master prompt §3.4).
//
// Records a human verification of one or more reference rows: writes
// an append-only event to public.ref_verification_events, then
// updates the denormalized verified / verified_by / verified_against
// / verified_at columns on the matched row(s) so the reference UI
// (Phase 3) can show verification status without a join.
//
// Role gate: writes to ref_verification_events and to any ref_*
// table are restricted by RLS to platform_admin (see the
// "*_write_owner" / "ref_verification_events_insert_owner" policies
// in supabase/migrations/20260829_field_mode_reference_tables.sql).
// This CLI uses the service-role client (lib/supabase.ts) the same
// way import-reference-data.ts does, which bypasses RLS by design —
// it is a standalone, manually-run operator tool, not a
// request-serving surface, per that file's header comment. The
// actual owner-level gate for any WEB-facing verification console
// (Phase 3+) must check public.is_platform_admin() itself; this CLI
// is not that surface and trusts the operator running it locally.
//
// Usage:
//   npx tsx scripts/field-mode/verify-ref.ts \
//     --table ref_flanges \
//     --filter "flange_class=300,nps=6" \
//     --by "RN" \
//     --against "Blue Book p.42" \
//     [--note "matches field-verified spool tag"] \
//     [--dry-run]
//
// --filter keys are literal database column names for --table (not
// CSV headers or friendly aliases) — e.g. `flange_class`, not
// `class`. This is deliberate: guessing aliases risks silently
// matching the wrong column on a table this script has never seen.
// ============================================================
import { getServiceClient } from './lib/supabase'

function parseArgs() {
  const argv = process.argv.slice(2)
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
  }
  const table = get('--table')
  const filter = get('--filter')
  const by = get('--by')
  const against = get('--against')
  const note = get('--note')
  const dryRun = argv.includes('--dry-run')

  const missing: string[] = []
  if (!table) missing.push('--table')
  if (!filter) missing.push('--filter')
  if (!by) missing.push('--by')
  if (!against) missing.push('--against')
  if (missing.length > 0) {
    console.error(`Missing required flag(s): ${missing.join(', ')}`)
    console.error('Usage: verify-ref --table <table> --filter "col=val,col2=val2" --by <name> --against <source> [--note <text>] [--dry-run]')
    process.exit(1)
  }

  const filterPairs: Record<string, string> = {}
  for (const part of filter!.split(',')) {
    const eq = part.indexOf('=')
    if (eq < 0) {
      console.error(`Bad --filter segment "${part}" — expected col=value`)
      process.exit(1)
    }
    filterPairs[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }

  return { table: table!, filterPairs, by: by!, against: against!, note: note ?? null, dryRun }
}

async function main() {
  const { table, filterPairs, by, against, note, dryRun } = parseArgs()
  const client = getServiceClient()

  let q = client.from(table).select('id').is('superseded_by_batch', null)
  for (const [k, v] of Object.entries(filterPairs)) q = q.eq(k, v)
  const { data: rows, error } = await q

  if (error) {
    console.error(`Lookup failed: ${error.message}`)
    process.exit(1)
  }
  if (!rows || rows.length === 0) {
    console.error(`No un-superseded rows in ${table} match ${JSON.stringify(filterPairs)}`)
    process.exit(1)
  }

  console.log(`Matched ${rows.length} row(s) in ${table} for ${JSON.stringify(filterPairs)}${dryRun ? ' [DRY RUN]' : ''}`)

  if (dryRun) {
    for (const r of rows) console.log(`  would verify id=${(r as any).id}`)
    return
  }

  const now = new Date().toISOString()
  for (const r of rows) {
    const rowId = (r as any).id
    const { error: eventErr } = await client.from('ref_verification_events').insert({
      table_name: table,
      row_id: rowId,
      verified: true,
      verified_by: by,
      verified_against: against,
      note,
    })
    if (eventErr) {
      console.error(`  FAILED to log verification event for id=${rowId}: ${eventErr.message}`)
      process.exitCode = 1
      continue
    }
    const { error: updateErr } = await client
      .from(table)
      .update({ verified: true, verified_by: by, verified_against: against, verified_at: now })
      .eq('id', rowId)
    if (updateErr) {
      console.error(`  FAILED to update row id=${rowId}: ${updateErr.message}`)
      process.exitCode = 1
      continue
    }
    console.log(`  verified id=${rowId}`)
  }
}

main()

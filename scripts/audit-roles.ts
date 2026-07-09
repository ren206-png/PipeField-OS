#!/usr/bin/env tsx
// ============================================================
// Role Audit Script
// Usage: npx tsx scripts/audit-roles.ts
//
// Checks:
//   1. All auth.users have a corresponding user_profiles row
//   2. All roles are valid (match the allowed set)
//   3. All organization_ids reference real organizations
//   4. Reports any mismatches and optionally fixes them
// ============================================================
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const VALID_ROLES = [
  'platform_admin',
  'organization_owner',
  'administrator',
  'project_manager',
  'welding_inspector',
  'qa_inspector',
  'welder',
  'client_viewer',
] as const

type ValidRole = typeof VALID_ROLES[number]

async function main() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log('\n🔍  PipeField OS — Role & Profile Audit\n' + '─'.repeat(50))

  // ── 1. Load all auth users ─────────────────────────────────
  const { data: { users }, error: usersErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (usersErr) { console.error('❌  Cannot list auth users:', usersErr.message); process.exit(1) }

  // ── 2. Load all profiles ───────────────────────────────────
  const { data: profiles, error: profErr } = await admin
    .from('user_profiles')
    .select('id, auth_user_id, role, organization_id, full_name, status')
  if (profErr) { console.error('❌  Cannot load user_profiles:', profErr.message); process.exit(1) }

  // ── 3. Load all org IDs ────────────────────────────────────
  const { data: orgs, error: orgErr } = await admin.from('organizations').select('id, name')
  if (orgErr) { console.error('❌  Cannot load organizations:', orgErr.message); process.exit(1) }

  const orgIds = new Set((orgs ?? []).map((o: { id: string }) => o.id))
  const profilesByAuthId = new Map((profiles ?? []).map((p: { auth_user_id: string }) => [p.auth_user_id, p]))

  let issues = 0

  // ── 4. Check: every auth user has a profile ────────────────
  console.log('\n📋  Checking profile coverage...')
  for (const user of users) {
    if (!profilesByAuthId.has(user.id)) {
      console.warn(`  ⚠️  No profile for auth user ${user.email ?? user.id}`)
      issues++
    }
  }
  if (issues === 0) console.log('  ✅  All auth users have profiles')

  // ── 5. Check: roles are valid ──────────────────────────────
  console.log('\n🔑  Checking roles...')
  let roleIssues = 0
  for (const p of profiles ?? []) {
    const profile = p as { id: string; auth_user_id: string; role: string; organization_id: string | null; full_name: string | null }
    if (!VALID_ROLES.includes(profile.role as ValidRole)) {
      console.warn(`  ⚠️  Invalid role "${profile.role}" for ${profile.full_name ?? profile.auth_user_id}`)
      roleIssues++
      issues++
    }
  }
  if (roleIssues === 0) console.log('  ✅  All roles are valid')

  // ── 6. Check: org IDs exist ────────────────────────────────
  console.log('\n🏢  Checking organization references...')
  let orgIssues = 0
  for (const p of profiles ?? []) {
    const profile = p as { id: string; auth_user_id: string; role: string; organization_id: string | null; full_name: string | null }
    if (profile.organization_id && !orgIds.has(profile.organization_id)) {
      console.warn(`  ⚠️  Profile ${profile.full_name ?? profile.auth_user_id} references non-existent org ${profile.organization_id}`)
      orgIssues++
      issues++
    }
  }
  if (orgIssues === 0) console.log('  ✅  All organization references are valid')

  // ── 7. Summary ─────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50))
  if (issues === 0) {
    console.log('✅  Audit passed — no issues found\n')
    process.exit(0)
  } else {
    console.log(`❌  Audit found ${issues} issue(s) — review the warnings above\n`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

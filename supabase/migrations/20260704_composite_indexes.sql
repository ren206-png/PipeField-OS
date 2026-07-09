-- ============================================================
-- Composite indexes for common list-query patterns.
--
-- All list pages filter by organization_id (via RLS) and then
-- ORDER BY created_at DESC (or a table-specific sort column).
-- The existing single-column org indexes force Postgres to
-- scan all org rows and sort them; composite indexes let it
-- satisfy both the filter and the sort order in one index scan.
--
-- Spools are sorted by (priority ASC, spool_number ASC) so
-- their composite covers that multi-column order pattern.
-- ============================================================

-- ── Core entity tables ────────────────────────────────────────

-- welds: main list sorted by created_at; secondary filter on project_id
create index if not exists idx_welds_org_created
  on welds(organization_id, created_at desc);

create index if not exists idx_welds_project_created
  on welds(project_id, created_at desc);

-- spools: sorted by priority then spool_number
create index if not exists idx_spools_org_priority_number
  on spools(organization_id, priority asc, spool_number asc);

-- projects: sorted by created_at
create index if not exists idx_projects_org_created
  on projects(organization_id, created_at desc);

-- ── Document / compliance tables ─────────────────────────────

create index if not exists idx_ncrs_org_created
  on ncrs(organization_id, created_at desc);

create index if not exists idx_rfis_org_created
  on rfis(organization_id, created_at desc);

create index if not exists idx_itps_org_created
  on itps(organization_id, created_at desc);

create index if not exists idx_docs_org_created
  on documents(organization_id, created_at desc);

-- ── Audit log ─────────────────────────────────────────────────
-- Two common access patterns:
--   (1) dashboard: org_id ORDER BY performed_at DESC LIMIT 12
--   (2) weld timeline: table_name = 'welds' AND record_id = ? ORDER BY performed_at DESC
create index if not exists idx_audit_logs_org_performed
  on audit_logs(organization_id, performed_at desc);

create index if not exists idx_audit_logs_record_performed
  on audit_logs(table_name, record_id, performed_at desc);

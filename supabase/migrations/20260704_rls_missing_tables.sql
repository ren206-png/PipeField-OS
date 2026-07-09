-- ============================================================
-- RLS policies for tables that were missing row-level security.
--
-- Tables covered:
--   • weld_repairs        (organization_id column)
--   • wps_records         (organization_id column)
--   • project_milestones  (project_id → projects.organization_id)
--
-- share_link_views is intentionally excluded — all writes go
-- through the service-role admin client (no direct user access).
-- ============================================================

-- ── weld_repairs ─────────────────────────────────────────────
alter table weld_repairs enable row level security;

create policy "org members can manage weld repairs"
  on weld_repairs for all using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );

-- ── wps_records ──────────────────────────────────────────────
alter table wps_records enable row level security;

create policy "org members can manage WPS records"
  on wps_records for all using (
    organization_id in (
      select organization_id from user_profiles where auth_user_id = auth.uid()
    )
  );

-- ── project_milestones ───────────────────────────────────────
alter table project_milestones enable row level security;

create policy "org members can manage project milestones"
  on project_milestones for all using (
    project_id in (
      select p.id
      from   projects p
      join   user_profiles up on up.organization_id = p.organization_id
      where  up.auth_user_id = auth.uid()
    )
  );

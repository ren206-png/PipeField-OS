-- ============================================================
-- Billing write-lock at the database level (RLS)
--
-- A locked org (payment failed and the grace period has ended, or a free
-- trial ended without a plan) keeps READ access but cannot INSERT, UPDATE
-- or DELETE its data — including from screens that write through the
-- Supabase client (which bypass the API-level lock in requireAuth).
--
-- Mirrors getLockoutReason() in src/lib/billing-access.ts. Keep in sync.
--
-- Policies are RESTRICTIVE: they are ANDed with the existing permissive
-- policies, so they can only take write access away, never grant it.
-- service_role (server routes) bypasses RLS and is covered by the API lock.
-- Platform admins are never locked.
--
-- Left writable on purpose: notifications, user_profiles, push_subscriptions,
-- feedback, error_logs, audit_logs, ai_invocations, knowledge_queries,
-- knowledge_audit_log (used while reading, or needed to fix billing).
-- ============================================================

create or replace function public.org_can_write(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_org is null then true
    when exists (
      select 1 from public.user_profiles up
      where up.auth_user_id = auth.uid() and up.role = 'platform_admin'
    ) then true
    else not exists (
      select 1 from public.organizations o
      where o.id = p_org
        and (
          (o.subscription_status = 'past_due'
             and o.grace_period_ends_at is not null
             and o.grace_period_ends_at < now())
          or
          (o.subscription_status = 'canceled'
             and o.subscription_tier = 'free_trial'
             and o.trial_ends_at is not null
             and o.trial_ends_at < now())
        )
    )
  end
$$;

revoke all on function public.org_can_write(uuid) from public;
grant execute on function public.org_can_write(uuid) to authenticated, service_role;


drop policy if exists billing_lock_insert on public.checklist_templates;
drop policy if exists billing_lock_update on public.checklist_templates;
drop policy if exists billing_lock_delete on public.checklist_templates;
create policy billing_lock_insert on public.checklist_templates as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.checklist_templates as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.checklist_templates as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.client_share_links;
drop policy if exists billing_lock_update on public.client_share_links;
drop policy if exists billing_lock_delete on public.client_share_links;
create policy billing_lock_insert on public.client_share_links as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.client_share_links as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.client_share_links as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.daily_field_reports;
drop policy if exists billing_lock_update on public.daily_field_reports;
drop policy if exists billing_lock_delete on public.daily_field_reports;
create policy billing_lock_insert on public.daily_field_reports as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.daily_field_reports as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.daily_field_reports as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.documents;
drop policy if exists billing_lock_update on public.documents;
drop policy if exists billing_lock_delete on public.documents;
create policy billing_lock_insert on public.documents as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.documents as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.documents as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.erp_connectors;
drop policy if exists billing_lock_update on public.erp_connectors;
drop policy if exists billing_lock_delete on public.erp_connectors;
create policy billing_lock_insert on public.erp_connectors as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.erp_connectors as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.erp_connectors as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.erp_job_mappings;
drop policy if exists billing_lock_update on public.erp_job_mappings;
drop policy if exists billing_lock_delete on public.erp_job_mappings;
create policy billing_lock_insert on public.erp_job_mappings as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.erp_job_mappings as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.erp_job_mappings as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.erp_weld_exports;
drop policy if exists billing_lock_update on public.erp_weld_exports;
drop policy if exists billing_lock_delete on public.erp_weld_exports;
create policy billing_lock_insert on public.erp_weld_exports as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.erp_weld_exports as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.erp_weld_exports as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.flange_joints;
drop policy if exists billing_lock_update on public.flange_joints;
drop policy if exists billing_lock_delete on public.flange_joints;
create policy billing_lock_insert on public.flange_joints as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.flange_joints as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.flange_joints as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.flanges;
drop policy if exists billing_lock_update on public.flanges;
drop policy if exists billing_lock_delete on public.flanges;
create policy billing_lock_insert on public.flanges as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.flanges as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.flanges as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.handover_certificates;
drop policy if exists billing_lock_update on public.handover_certificates;
drop policy if exists billing_lock_delete on public.handover_certificates;
create policy billing_lock_insert on public.handover_certificates as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.handover_certificates as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.handover_certificates as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.itp_items;
drop policy if exists billing_lock_update on public.itp_items;
drop policy if exists billing_lock_delete on public.itp_items;
create policy billing_lock_insert on public.itp_items as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.itp_items as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.itp_items as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.itps;
drop policy if exists billing_lock_update on public.itps;
drop policy if exists billing_lock_delete on public.itps;
create policy billing_lock_insert on public.itps as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.itps as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.itps as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.knowledge_categories;
drop policy if exists billing_lock_update on public.knowledge_categories;
drop policy if exists billing_lock_delete on public.knowledge_categories;
create policy billing_lock_insert on public.knowledge_categories as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.knowledge_categories as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.knowledge_categories as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.knowledge_chunks;
drop policy if exists billing_lock_update on public.knowledge_chunks;
drop policy if exists billing_lock_delete on public.knowledge_chunks;
create policy billing_lock_insert on public.knowledge_chunks as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.knowledge_chunks as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.knowledge_chunks as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.knowledge_permissions;
drop policy if exists billing_lock_update on public.knowledge_permissions;
drop policy if exists billing_lock_delete on public.knowledge_permissions;
create policy billing_lock_insert on public.knowledge_permissions as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.knowledge_permissions as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.knowledge_permissions as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.knowledge_sources;
drop policy if exists billing_lock_update on public.knowledge_sources;
drop policy if exists billing_lock_delete on public.knowledge_sources;
create policy billing_lock_insert on public.knowledge_sources as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.knowledge_sources as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.knowledge_sources as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.knowledge_tags;
drop policy if exists billing_lock_update on public.knowledge_tags;
drop policy if exists billing_lock_delete on public.knowledge_tags;
create policy billing_lock_insert on public.knowledge_tags as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.knowledge_tags as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.knowledge_tags as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.line_list;
drop policy if exists billing_lock_update on public.line_list;
drop policy if exists billing_lock_delete on public.line_list;
create policy billing_lock_insert on public.line_list as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.line_list as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.line_list as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.mtr_documents;
drop policy if exists billing_lock_update on public.mtr_documents;
drop policy if exists billing_lock_delete on public.mtr_documents;
create policy billing_lock_insert on public.mtr_documents as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.mtr_documents as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.mtr_documents as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.mtrs;
drop policy if exists billing_lock_update on public.mtrs;
drop policy if exists billing_lock_delete on public.mtrs;
create policy billing_lock_insert on public.mtrs as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.mtrs as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.mtrs as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.ncrs;
drop policy if exists billing_lock_update on public.ncrs;
drop policy if exists billing_lock_delete on public.ncrs;
create policy billing_lock_insert on public.ncrs as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.ncrs as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.ncrs as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.nde_code_profiles;
drop policy if exists billing_lock_update on public.nde_code_profiles;
drop policy if exists billing_lock_delete on public.nde_code_profiles;
create policy billing_lock_insert on public.nde_code_profiles as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.nde_code_profiles as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.nde_code_profiles as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.nde_inspections;
drop policy if exists billing_lock_update on public.nde_inspections;
drop policy if exists billing_lock_delete on public.nde_inspections;
create policy billing_lock_insert on public.nde_inspections as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.nde_inspections as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.nde_inspections as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.nde_plans;
drop policy if exists billing_lock_update on public.nde_plans;
drop policy if exists billing_lock_delete on public.nde_plans;
create policy billing_lock_insert on public.nde_plans as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.nde_plans as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.nde_plans as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.nde_selections;
drop policy if exists billing_lock_update on public.nde_selections;
drop policy if exists billing_lock_delete on public.nde_selections;
create policy billing_lock_insert on public.nde_selections as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.nde_selections as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.nde_selections as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.ndt_requirements;
drop policy if exists billing_lock_update on public.ndt_requirements;
drop policy if exists billing_lock_delete on public.ndt_requirements;
create policy billing_lock_insert on public.ndt_requirements as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.ndt_requirements as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.ndt_requirements as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.pending_invites;
drop policy if exists billing_lock_update on public.pending_invites;
drop policy if exists billing_lock_delete on public.pending_invites;
create policy billing_lock_insert on public.pending_invites as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.pending_invites as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.pending_invites as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.pipe_support_calculations;
drop policy if exists billing_lock_update on public.pipe_support_calculations;
drop policy if exists billing_lock_delete on public.pipe_support_calculations;
create policy billing_lock_insert on public.pipe_support_calculations as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.pipe_support_calculations as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.pipe_support_calculations as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.precomm_items;
drop policy if exists billing_lock_update on public.precomm_items;
drop policy if exists billing_lock_delete on public.precomm_items;
create policy billing_lock_insert on public.precomm_items as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.precomm_items as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.precomm_items as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.pressure_tests;
drop policy if exists billing_lock_update on public.pressure_tests;
drop policy if exists billing_lock_delete on public.pressure_tests;
create policy billing_lock_insert on public.pressure_tests as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.pressure_tests as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.pressure_tests as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.project_milestones;
drop policy if exists billing_lock_update on public.project_milestones;
drop policy if exists billing_lock_delete on public.project_milestones;
create policy billing_lock_insert on public.project_milestones as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.project_milestones as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.project_milestones as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.projects;
drop policy if exists billing_lock_update on public.projects;
drop policy if exists billing_lock_delete on public.projects;
create policy billing_lock_insert on public.projects as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.projects as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.projects as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.punch_items;
drop policy if exists billing_lock_update on public.punch_items;
drop policy if exists billing_lock_delete on public.punch_items;
create policy billing_lock_insert on public.punch_items as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.punch_items as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.punch_items as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.rfis;
drop policy if exists billing_lock_update on public.rfis;
drop policy if exists billing_lock_delete on public.rfis;
create policy billing_lock_insert on public.rfis as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.rfis as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.rfis as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.signatures;
drop policy if exists billing_lock_update on public.signatures;
drop policy if exists billing_lock_delete on public.signatures;
create policy billing_lock_insert on public.signatures as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.signatures as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.signatures as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.spool_items;
drop policy if exists billing_lock_update on public.spool_items;
drop policy if exists billing_lock_delete on public.spool_items;
create policy billing_lock_insert on public.spool_items as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.spool_items as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.spool_items as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.spool_qr_codes;
drop policy if exists billing_lock_update on public.spool_qr_codes;
drop policy if exists billing_lock_delete on public.spool_qr_codes;
create policy billing_lock_insert on public.spool_qr_codes as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.spool_qr_codes as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.spool_qr_codes as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.spools;
drop policy if exists billing_lock_update on public.spools;
drop policy if exists billing_lock_delete on public.spools;
create policy billing_lock_insert on public.spools as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.spools as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.spools as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.system_turnover_packages;
drop policy if exists billing_lock_update on public.system_turnover_packages;
drop policy if exists billing_lock_delete on public.system_turnover_packages;
create policy billing_lock_insert on public.system_turnover_packages as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.system_turnover_packages as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.system_turnover_packages as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.turnover_packages;
drop policy if exists billing_lock_update on public.turnover_packages;
drop policy if exists billing_lock_delete on public.turnover_packages;
create policy billing_lock_insert on public.turnover_packages as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.turnover_packages as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.turnover_packages as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.weld_checklists;
drop policy if exists billing_lock_update on public.weld_checklists;
drop policy if exists billing_lock_delete on public.weld_checklists;
create policy billing_lock_insert on public.weld_checklists as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.weld_checklists as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.weld_checklists as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.weld_events;
drop policy if exists billing_lock_update on public.weld_events;
drop policy if exists billing_lock_delete on public.weld_events;
create policy billing_lock_insert on public.weld_events as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.weld_events as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.weld_events as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.weld_inspections;
drop policy if exists billing_lock_update on public.weld_inspections;
drop policy if exists billing_lock_delete on public.weld_inspections;
create policy billing_lock_insert on public.weld_inspections as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.weld_inspections as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.weld_inspections as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.weld_photos;
drop policy if exists billing_lock_update on public.weld_photos;
drop policy if exists billing_lock_delete on public.weld_photos;
create policy billing_lock_insert on public.weld_photos as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.weld_photos as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.weld_photos as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.weld_qualifications;
drop policy if exists billing_lock_update on public.weld_qualifications;
drop policy if exists billing_lock_delete on public.weld_qualifications;
create policy billing_lock_insert on public.weld_qualifications as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.weld_qualifications as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.weld_qualifications as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.weld_repairs;
drop policy if exists billing_lock_update on public.weld_repairs;
drop policy if exists billing_lock_delete on public.weld_repairs;
create policy billing_lock_insert on public.weld_repairs as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.weld_repairs as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.weld_repairs as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.welder_certifications;
drop policy if exists billing_lock_update on public.welder_certifications;
drop policy if exists billing_lock_delete on public.welder_certifications;
create policy billing_lock_insert on public.welder_certifications as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.welder_certifications as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.welder_certifications as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.welder_continuity;
drop policy if exists billing_lock_update on public.welder_continuity;
drop policy if exists billing_lock_delete on public.welder_continuity;
create policy billing_lock_insert on public.welder_continuity as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.welder_continuity as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.welder_continuity as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.welders;
drop policy if exists billing_lock_update on public.welders;
drop policy if exists billing_lock_delete on public.welders;
create policy billing_lock_insert on public.welders as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.welders as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.welders as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.welds;
drop policy if exists billing_lock_update on public.welds;
drop policy if exists billing_lock_delete on public.welds;
create policy billing_lock_insert on public.welds as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.welds as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.welds as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

drop policy if exists billing_lock_insert on public.wps_records;
drop policy if exists billing_lock_update on public.wps_records;
drop policy if exists billing_lock_delete on public.wps_records;
create policy billing_lock_insert on public.wps_records as restrictive for insert to authenticated
  with check (public.org_can_write(organization_id));
create policy billing_lock_update on public.wps_records as restrictive for update to authenticated
  using (public.org_can_write(organization_id)) with check (public.org_can_write(organization_id));
create policy billing_lock_delete on public.wps_records as restrictive for delete to authenticated
  using (public.org_can_write(organization_id));

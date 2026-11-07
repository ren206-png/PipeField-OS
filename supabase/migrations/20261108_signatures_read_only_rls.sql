-- ============================================================
-- SEC-004: signatures are written only through POST /api/signatures
-- (service role), which checks role, record ownership and slot, and sets
-- signed_by from the session. The old FOR ALL policy let any org member
-- insert, edit or delete signatures directly via the Supabase REST API,
-- with any signer_name / signed_by. Members keep read access.
-- ============================================================

drop policy if exists "org members can manage signatures" on public.signatures;

drop policy if exists signatures_select_org on public.signatures;
create policy signatures_select_org
  on public.signatures for select
  using (
    organization_id in (
      select organization_id from public.user_profiles where auth_user_id = auth.uid()
    )
  );

-- Verification (SQL editor):
--   select policyname, cmd from pg_policies where tablename = 'signatures';
--     → only signatures_select_org (SELECT)

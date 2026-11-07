-- ============================================================
-- SEC-001: lock privilege columns on user_profiles
--
-- The UPDATE policies on user_profiles let a user update their own row with
-- no column restriction, and every RLS helper + the API trust role and
-- organization_id from that row. A signed-in user could PATCH their own
-- profile to role='platform_admin' or to another tenant's organization_id.
--
-- This BEFORE UPDATE trigger rejects changes to the privilege columns
-- unless the change comes from:
--   * a server context with no end-user JWT (service_role routes,
--     migrations, SQL editor) — auth.uid() is null there, or
--   * an active platform admin (checked against the OLD row state).
-- Org admins may still change ANOTHER member's role inside their own org,
-- but never their own row, never to/from platform_admin or
-- organization_owner, and never organization_id / auth_user_id.
--
-- Cosmetic columns (full_name, phone, welder_stamp, avatar_url, ...) stay
-- self-editable — Settings → Profile only writes those.
-- ============================================================

create or replace function public.guard_user_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Server-side writes (service role / migrations) are trusted.
  if v_uid is null then
    return new;
  end if;

  if public.is_platform_admin() then
    return new;
  end if;

  -- Nobody else may move a profile between tenants or rebind the login.
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed' using errcode = '42501';
  end if;
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'auth_user_id cannot be changed' using errcode = '42501';
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.is_active is distinct from old.is_active then

    -- Never on your own row.
    if old.auth_user_id = v_uid then
      raise exception 'you cannot change your own role or status' using errcode = '42501';
    end if;

    -- Org admins, same org only.
    if not (public.is_org_admin() and old.organization_id = public.my_org_id()) then
      raise exception 'not allowed to change role or status' using errcode = '42501';
    end if;

    -- Owner and platform roles are not grantable or removable here.
    if new.role is distinct from old.role
       and (new.role in ('platform_admin', 'organization_owner')
            or old.role in ('platform_admin', 'organization_owner')) then
      raise exception 'role % cannot be assigned here', new.role using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;

revoke all on function public.guard_user_profile_privileges() from public;

drop trigger if exists trg_guard_user_profile_privileges on public.user_profiles;
create trigger trg_guard_user_profile_privileges
  before update on public.user_profiles
  for each row execute function public.guard_user_profile_privileges();

-- ------------------------------------------------------------
-- Verification (run after applying, as a NON-admin signed-in user
-- through the REST API / supabase-js — not in the SQL editor):
--   update user_profiles set role = 'platform_admin' where auth_user_id = auth.uid();
--     → ERROR 42501 "you cannot change your own role or status"
--   update user_profiles set organization_id = '<other org>' where auth_user_id = auth.uid();
--     → ERROR 42501 "organization_id cannot be changed"
--   update user_profiles set full_name = 'x' where auth_user_id = auth.uid();
--     → succeeds
--
-- Audit for prior abuse (SQL editor):
--   select id, email, role, organization_id, updated_at
--   from user_profiles where role = 'platform_admin';
-- ------------------------------------------------------------

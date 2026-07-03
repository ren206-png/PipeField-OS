-- ============================================================
-- PipeField OS — All database fixes combined
-- Run this once in Supabase SQL Editor
-- ============================================================

-- ── 1. Fix projects table ─────────────────────────────────────
-- Make project_number optional (it was NOT NULL)
ALTER TABLE public.projects
  ALTER COLUMN project_number DROP NOT NULL;

-- Remove unique constraint so blank project_number is allowed
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_organization_id_project_number_key;

-- Fix status values to include 'completed' and 'cancelled'
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('planning','active','on_hold','completed','complete','cancelled','archived'));

-- ── 2. Fix RLS policies ───────────────────────────────────────

-- Organizations: allow authenticated users to insert (needed for registration)
DROP POLICY IF EXISTS "org_isolation"             ON public.organizations;
DROP POLICY IF EXISTS "org_insert_authenticated"  ON public.organizations;
DROP POLICY IF EXISTS "org_select_own"            ON public.organizations;
DROP POLICY IF EXISTS "org_update_own"            ON public.organizations;

CREATE POLICY "org_insert_authenticated"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "org_select_own"
  ON public.organizations FOR SELECT
  USING (id = public.get_my_org_id());

CREATE POLICY "org_update_own"
  ON public.organizations FOR UPDATE
  USING (id = public.get_my_org_id());

-- User profiles: allow users to insert their own profile
DROP POLICY IF EXISTS "profiles_admin_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_self_insert"  ON public.user_profiles;

CREATE POLICY "profiles_self_insert"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Projects: split into per-operation policies (fixes silent failures)
DROP POLICY IF EXISTS "projects_org_isolation" ON public.projects;
DROP POLICY IF EXISTS "projects_select"        ON public.projects;
DROP POLICY IF EXISTS "projects_insert"        ON public.projects;
DROP POLICY IF EXISTS "projects_update"        ON public.projects;
DROP POLICY IF EXISTS "projects_delete"        ON public.projects;

CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "projects_insert"
  ON public.projects FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());

CREATE POLICY "projects_update"
  ON public.projects FOR UPDATE
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "projects_delete"
  ON public.projects FOR DELETE
  USING (organization_id = public.get_my_org_id());

-- ── 3. Done ───────────────────────────────────────────────────
-- You should now be able to:
-- 1. Register a new account (org + profile created via API route)
-- 2. Create projects without errors
-- 3. Log welds and spools normally

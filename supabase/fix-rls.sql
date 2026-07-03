-- ============================================================
-- Fix: RLS policies for registration flow
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── ORGANIZATIONS ────────────────────────────────────────────

-- Drop the old policy that blocked new org creation
DROP POLICY IF EXISTS "org_isolation" ON public.organizations;

-- Allow any authenticated user to create an org (registration)
CREATE POLICY "org_insert_authenticated"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- After creation, users can only read/update their own org
CREATE POLICY "org_select_own"
  ON public.organizations FOR SELECT
  USING (id = public.get_my_org_id());

CREATE POLICY "org_update_own"
  ON public.organizations FOR UPDATE
  USING (id = public.get_my_org_id());

-- ── USER PROFILES ────────────────────────────────────────────

-- Drop the old broken insert policy
DROP POLICY IF EXISTS "profiles_admin_insert" ON public.user_profiles;

-- Allow any authenticated user to insert their OWN profile
-- (the auth_user_id must match the person making the request)
CREATE POLICY "profiles_self_insert"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- ── PROJECTS ─────────────────────────────────────────────────

-- Drop and recreate with separate INSERT policy
-- (The all-in-one policy blocks when get_my_org_id() is slow to resolve)
DROP POLICY IF EXISTS "projects_org_isolation" ON public.projects;

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

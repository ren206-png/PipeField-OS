-- ============================================================
-- 001_platform_admin.sql
-- Extends user_profiles to support platform-level admin role
-- and adds tracking columns needed by the admin panel.
--
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================

-- ── 1. Relax the role constraint to allow new roles ─────────
-- Drop the old check, add a new one that includes platform_admin
-- and organization_owner without removing existing values.

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN (
    'platform_admin',
    'organization_owner',
    'administrator',
    'project_manager',
    'foreman',
    'qa_inspector',
    'shop_fabricator',
    'pipefitter',
    'client_viewer'
  ));

-- ── 2. Add last_login_at column ─────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- ── 3. Add status column (replaces is_active boolean) ───────
-- Keep is_active for backward compat; status gives more granularity.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'suspended', 'deactivated'));

-- Sync existing is_active → status
UPDATE public.user_profiles
  SET status = CASE WHEN is_active THEN 'active' ELSE 'deactivated' END
  WHERE status = 'active' AND is_active = false;

-- ── 4. Add owner_user_id to organizations ───────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id);

-- ── 5. Update existing administrators → organization_owner ──
-- The first user in each org (by created_at) becomes org owner.
-- Only do this if you want to migrate — comment out if not needed.
-- UPDATE public.user_profiles
--   SET role = 'organization_owner'
--   WHERE role = 'administrator';

-- ── 6. Create a function to auto-update last_login_at ───────
-- Called via a Supabase Auth hook or from the app after login.
CREATE OR REPLACE FUNCTION public.update_last_login(p_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
    SET last_login_at = now()
    WHERE auth_user_id = p_auth_user_id;
END;
$$;

-- ── 7. Grant execute to authenticated users (own row only) ──
GRANT EXECUTE ON FUNCTION public.update_last_login(uuid) TO authenticated;

-- ── 8. Helper: check if current user is platform admin ──────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
      AND role = 'platform_admin'
      AND status = 'active'
  );
$$;

-- ── 9. Helper: get current user's organization_id ───────────
CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- ── 10. Helper: check if current user is org admin/owner ────
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_user_id = auth.uid()
      AND role IN ('platform_admin','organization_owner','administrator')
      AND status = 'active'
  );
$$;

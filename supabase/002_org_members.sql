-- ============================================================
-- 002_org_members.sql
-- Creates set_updated_at() trigger function (if missing),
-- then creates the organization_members table.
-- Run AFTER 001_platform_admin.sql
-- ============================================================

-- ── set_updated_at trigger function (may already exist) ──────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── organization_members table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'pipefitter'
                    CHECK (role IN (
                      'organization_owner','administrator','project_manager',
                      'foreman','qa_inspector','shop_fabricator','pipefitter','client_viewer'
                    )),
  invited_by      uuid REFERENCES auth.users(id),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','invited','suspended','deactivated')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);

-- ── updated_at trigger ───────────────────────────────────────
DROP TRIGGER IF EXISTS trg_org_members_updated_at ON public.organization_members;
CREATE TRIGGER trg_org_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Enable RLS ────────────────────────────────────────────────
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ── Drop old policies if they exist ──────────────────────────
DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_update" ON public.organization_members;
DROP POLICY IF EXISTS "org_members_delete" ON public.organization_members;

-- ── RLS Policies ─────────────────────────────────────────────

CREATE POLICY "org_members_select"
  ON public.organization_members
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR organization_id = public.my_org_id()
  );

CREATE POLICY "org_members_insert"
  ON public.organization_members
  FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

CREATE POLICY "org_members_update"
  ON public.organization_members
  FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

CREATE POLICY "org_members_delete"
  ON public.organization_members
  FOR DELETE
  USING (
    public.is_platform_admin()
    OR (
      organization_id = public.my_org_id()
      AND public.is_org_admin()
    )
  );

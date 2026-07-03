-- ============================================================
-- Fix spool (and weld) creation for existing users
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Recreate get_my_org_id() to be bulletproof
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM public.user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- 2. Make sure spools RLS policies exist (safe to re-run)
DO $$
BEGIN
  -- Drop old policies if they exist with wrong names
  DROP POLICY IF EXISTS "org members read spools"   ON public.spools;
  DROP POLICY IF EXISTS "org members insert spools" ON public.spools;
  DROP POLICY IF EXISTS "org members update spools" ON public.spools;
  DROP POLICY IF EXISTS "org members delete spools" ON public.spools;
  DROP POLICY IF EXISTS "spools_select" ON public.spools;
  DROP POLICY IF EXISTS "spools_insert" ON public.spools;
  DROP POLICY IF EXISTS "spools_update" ON public.spools;
  DROP POLICY IF EXISTS "spools_delete" ON public.spools;
END $$;

ALTER TABLE public.spools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spools_select" ON public.spools FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "spools_insert" ON public.spools FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());

CREATE POLICY "spools_update" ON public.spools FOR UPDATE
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "spools_delete" ON public.spools FOR DELETE
  USING (organization_id = public.get_my_org_id());

-- 3. Same for spool_items
DO $$
BEGIN
  DROP POLICY IF EXISTS "org members read spool_items"   ON public.spool_items;
  DROP POLICY IF EXISTS "org members insert spool_items" ON public.spool_items;
  DROP POLICY IF EXISTS "org members update spool_items" ON public.spool_items;
  DROP POLICY IF EXISTS "org members delete spool_items" ON public.spool_items;
  DROP POLICY IF EXISTS "spool_items_select" ON public.spool_items;
  DROP POLICY IF EXISTS "spool_items_insert" ON public.spool_items;
  DROP POLICY IF EXISTS "spool_items_update" ON public.spool_items;
  DROP POLICY IF EXISTS "spool_items_delete" ON public.spool_items;
END $$;

ALTER TABLE public.spool_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spool_items_select" ON public.spool_items FOR SELECT
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "spool_items_insert" ON public.spool_items FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());

CREATE POLICY "spool_items_update" ON public.spool_items FOR UPDATE
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "spool_items_delete" ON public.spool_items FOR DELETE
  USING (organization_id = public.get_my_org_id());

-- 4. Make sure audit_logs allows inserts from org members
DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;

CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());

-- Done

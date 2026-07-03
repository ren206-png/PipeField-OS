-- ============================================================
-- Fix spools table — add all missing columns safely
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.spools
  ADD COLUMN IF NOT EXISTS pipe_size        TEXT,
  ADD COLUMN IF NOT EXISTS pipe_schedule    TEXT,
  ADD COLUMN IF NOT EXISTS material         TEXT,
  ADD COLUMN IF NOT EXISTS service          TEXT,
  ADD COLUMN IF NOT EXISTS design_pressure  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS design_temp      NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS total_welds      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_length_in  NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS isometric_ref    TEXT,
  ADD COLUMN IF NOT EXISTS area             TEXT,
  ADD COLUMN IF NOT EXISTS priority         INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS required_date    DATE,
  ADD COLUMN IF NOT EXISTS released_date    DATE,
  ADD COLUMN IF NOT EXISTS revision         TEXT DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES public.user_profiles(id);

-- Make sure spool_items table exists too
CREATE TABLE IF NOT EXISTS public.spool_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spool_id        UUID NOT NULL REFERENCES public.spools(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_number     INTEGER NOT NULL,
  item_type       TEXT NOT NULL,
  description     TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  length_in       NUMERIC(10,3),
  heat_number     TEXT,
  is_cut          BOOLEAN DEFAULT FALSE,
  is_fitted       BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.spool_items ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies cleanly
DO $$ BEGIN
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

CREATE POLICY "spools_select" ON public.spools FOR SELECT USING (organization_id = public.get_my_org_id());
CREATE POLICY "spools_insert" ON public.spools FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "spools_update" ON public.spools FOR UPDATE USING (organization_id = public.get_my_org_id());
CREATE POLICY "spools_delete" ON public.spools FOR DELETE USING (organization_id = public.get_my_org_id());

DO $$ BEGIN
  DROP POLICY IF EXISTS "org members read spool_items"   ON public.spool_items;
  DROP POLICY IF EXISTS "org members insert spool_items" ON public.spool_items;
  DROP POLICY IF EXISTS "org members update spool_items" ON public.spool_items;
  DROP POLICY IF EXISTS "org members delete spool_items" ON public.spool_items;
  DROP POLICY IF EXISTS "spool_items_select" ON public.spool_items;
  DROP POLICY IF EXISTS "spool_items_insert" ON public.spool_items;
  DROP POLICY IF EXISTS "spool_items_update" ON public.spool_items;
  DROP POLICY IF EXISTS "spool_items_delete" ON public.spool_items;
END $$;

CREATE POLICY "spool_items_select" ON public.spool_items FOR SELECT USING (organization_id = public.get_my_org_id());
CREATE POLICY "spool_items_insert" ON public.spool_items FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "spool_items_update" ON public.spool_items FOR UPDATE USING (organization_id = public.get_my_org_id());
CREATE POLICY "spool_items_delete" ON public.spool_items FOR DELETE USING (organization_id = public.get_my_org_id());

-- Reload schema cache so PostgREST picks up new columns immediately
NOTIFY pgrst, 'reload schema';

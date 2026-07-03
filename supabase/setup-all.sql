-- ============================================================
-- PipeField OS — Complete database setup / repair
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS)
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Add missing columns to welds ──────────────────────────
ALTER TABLE public.welds
  ADD COLUMN IF NOT EXISTS spool_number   TEXT,
  ADD COLUMN IF NOT EXISTS line_number    TEXT,
  ADD COLUMN IF NOT EXISTS pipe_size      TEXT,
  ADD COLUMN IF NOT EXISTS wall_thickness TEXT,
  ADD COLUMN IF NOT EXISTS weld_process   TEXT;

-- ── 2. Add missing columns to spools ─────────────────────────
ALTER TABLE public.spools
  ADD COLUMN IF NOT EXISTS revision        TEXT DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS pipe_size       TEXT,
  ADD COLUMN IF NOT EXISTS pipe_schedule   TEXT,
  ADD COLUMN IF NOT EXISTS material        TEXT,
  ADD COLUMN IF NOT EXISTS service         TEXT,
  ADD COLUMN IF NOT EXISTS design_pressure NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS design_temp     NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS total_welds     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_length_in NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS isometric_ref   TEXT,
  ADD COLUMN IF NOT EXISTS area            TEXT,
  ADD COLUMN IF NOT EXISTS priority        INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS required_date   DATE,
  ADD COLUMN IF NOT EXISTS released_date   DATE,
  ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES public.user_profiles(id);

-- Fix spool status constraint
ALTER TABLE public.spools DROP CONSTRAINT IF EXISTS spools_status_check;
ALTER TABLE public.spools ADD CONSTRAINT spools_status_check
  CHECK (status IN ('designed','material_released','cut','fit_up','welded','nde','painted','released'));

-- ── 3. Create spool_items table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.spool_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spool_id        UUID NOT NULL REFERENCES public.spools(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_number     INTEGER NOT NULL,
  item_type       TEXT NOT NULL DEFAULT 'other',
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

DROP POLICY IF EXISTS "spool_items_select" ON public.spool_items;
DROP POLICY IF EXISTS "spool_items_insert" ON public.spool_items;
DROP POLICY IF EXISTS "spool_items_update" ON public.spool_items;
DROP POLICY IF EXISTS "spool_items_delete" ON public.spool_items;

CREATE POLICY "spool_items_select" ON public.spool_items FOR SELECT USING (organization_id = public.get_my_org_id());
CREATE POLICY "spool_items_insert" ON public.spool_items FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "spool_items_update" ON public.spool_items FOR UPDATE USING (organization_id = public.get_my_org_id());
CREATE POLICY "spool_items_delete" ON public.spool_items FOR DELETE USING (organization_id = public.get_my_org_id());

-- ── 4. Create welders table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.welders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL,
  stamp            TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  process          TEXT[],
  position         TEXT[],
  certification_no TEXT,
  cert_expiry      DATE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_by       UUID REFERENCES public.user_profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, stamp)
);

ALTER TABLE public.welders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "welders_select" ON public.welders;
DROP POLICY IF EXISTS "welders_insert" ON public.welders;
DROP POLICY IF EXISTS "welders_update" ON public.welders;
DROP POLICY IF EXISTS "welders_delete" ON public.welders;

CREATE POLICY "welders_select" ON public.welders FOR SELECT USING (organization_id = public.get_my_org_id());
CREATE POLICY "welders_insert" ON public.welders FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "welders_update" ON public.welders FOR UPDATE USING (organization_id = public.get_my_org_id());
CREATE POLICY "welders_delete" ON public.welders FOR DELETE USING (organization_id = public.get_my_org_id());

-- ── 5. Create NDE inspections table ──────────────────────────
CREATE TABLE IF NOT EXISTS public.nde_inspections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weld_id          UUID NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inspection_type  TEXT NOT NULL CHECK (inspection_type IN ('RT','UT','PT','MT','VT','PMI','HT')),
  result           TEXT NOT NULL CHECK (result IN ('pending','pass','fail','repair','retest')),
  inspector_name   TEXT,
  inspection_date  DATE,
  report_number    TEXT,
  film_location    TEXT,
  acceptance_code  TEXT,
  defect_type      TEXT,
  defect_location  TEXT,
  repair_weld_id   UUID REFERENCES public.welds(id),
  notes            TEXT,
  created_by       UUID REFERENCES public.user_profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nde_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nde_select" ON public.nde_inspections;
DROP POLICY IF EXISTS "nde_insert" ON public.nde_inspections;
DROP POLICY IF EXISTS "nde_update" ON public.nde_inspections;
DROP POLICY IF EXISTS "nde_delete" ON public.nde_inspections;

CREATE POLICY "nde_select" ON public.nde_inspections FOR SELECT USING (organization_id = public.get_my_org_id());
CREATE POLICY "nde_insert" ON public.nde_inspections FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "nde_update" ON public.nde_inspections FOR UPDATE USING (organization_id = public.get_my_org_id());
CREATE POLICY "nde_delete" ON public.nde_inspections FOR DELETE USING (organization_id = public.get_my_org_id());

-- ── 6. Fix audit_logs RLS ─────────────────────────────────────
DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT
  WITH CHECK (organization_id = public.get_my_org_id());

-- ── 7. Reload schema cache ────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- Done. All tables, columns, and policies are now in place.

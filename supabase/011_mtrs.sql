CREATE TABLE IF NOT EXISTS public.mtrs (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  heat_number      text NOT NULL,           -- mill heat number e.g. "A1234B"
  mtr_number       text,                    -- MTR document number
  material_spec    text NOT NULL,           -- e.g. "ASTM A106 Grade B"
  material_type    text NOT NULL DEFAULT 'pipe'
                     CHECK (material_type IN ('pipe','fitting','flange','valve','bolt','gasket','plate','bar','other')),
  nominal_size     text,                    -- e.g. "6 inch", "DN150"
  schedule         text,                    -- e.g. "SCH 40", "STD"
  quantity         numeric(10,2),
  unit             text DEFAULT 'pcs',      -- pcs, m, ft, kg, lb
  supplier         text,
  manufacturer     text,
  received_date    date,
  po_number        text,                    -- purchase order number
  -- Chemical composition (key elements)
  carbon_pct       numeric(5,4),
  manganese_pct    numeric(5,4),
  phosphorus_pct   numeric(5,4),
  sulfur_pct       numeric(5,4),
  silicon_pct      numeric(5,4),
  -- Mechanical properties
  yield_strength   numeric(8,2),            -- MPa or psi
  tensile_strength numeric(8,2),
  elongation_pct   numeric(5,2),
  hardness         numeric(6,2),
  strength_unit    text DEFAULT 'MPa',
  -- Status
  status           text NOT NULL DEFAULT 'received'
                     CHECK (status IN ('received','accepted','rejected','quarantine','consumed')),
  rejection_reason text,
  storage_location text,
  notes            text,
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mtr_org     ON public.mtrs(organization_id);
CREATE INDEX IF NOT EXISTS idx_mtr_project ON public.mtrs(project_id);
CREATE INDEX IF NOT EXISTS idx_mtr_heat    ON public.mtrs(heat_number);
CREATE INDEX IF NOT EXISTS idx_mtr_status  ON public.mtrs(status);

ALTER TABLE public.mtrs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mtr_select" ON public.mtrs;
DROP POLICY IF EXISTS "mtr_insert" ON public.mtrs;
DROP POLICY IF EXISTS "mtr_update" ON public.mtrs;
DROP POLICY IF EXISTS "mtr_delete" ON public.mtrs;

CREATE POLICY "mtr_select" ON public.mtrs FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "mtr_insert" ON public.mtrs FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "mtr_update" ON public.mtrs FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "mtr_delete" ON public.mtrs FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

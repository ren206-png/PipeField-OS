CREATE TABLE IF NOT EXISTS public.line_list (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  line_number      text NOT NULL,           -- e.g. "3"-CS-1001-A1A"
  service          text,                    -- e.g. "Cooling Water Supply"
  fluid_code       text,                    -- e.g. "CWS"
  pipe_class       text,                    -- e.g. "A1A"
  nominal_size     text,                    -- e.g. "3 inch"
  design_pressure  numeric(10,2),
  design_temp      numeric(8,2),
  test_pressure    numeric(10,2),
  insulation       text,                    -- None / Hot / Cold / Personnel Prot
  from_equipment   text,                    -- e.g. "P-101A"
  to_equipment     text,                    -- e.g. "HX-201"
  total_welds      integer DEFAULT 0,       -- total expected welds
  total_spools     integer DEFAULT 0,       -- total expected spools
  status           text NOT NULL DEFAULT 'not_started'
                     CHECK (status IN ('not_started','in_fabrication','fab_complete','installed','tested','complete')),
  priority         text NOT NULL DEFAULT 'normal'
                     CHECK (priority IN ('low','normal','high','critical')),
  target_date      date,
  notes            text,
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_line_org     ON public.line_list(organization_id);
CREATE INDEX IF NOT EXISTS idx_line_project ON public.line_list(project_id);
CREATE INDEX IF NOT EXISTS idx_line_status  ON public.line_list(status);

ALTER TABLE public.line_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "line_select" ON public.line_list;
DROP POLICY IF EXISTS "line_insert" ON public.line_list;
DROP POLICY IF EXISTS "line_update" ON public.line_list;
DROP POLICY IF EXISTS "line_delete" ON public.line_list;

CREATE POLICY "line_select" ON public.line_list FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "line_insert" ON public.line_list FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "line_update" ON public.line_list FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "line_delete" ON public.line_list FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

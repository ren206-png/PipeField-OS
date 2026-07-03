CREATE TABLE IF NOT EXISTS public.pressure_tests (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_number       text NOT NULL,
  system_name       text NOT NULL,
  line_numbers      text,
  test_type         text NOT NULL DEFAULT 'hydrostatic'
                      CHECK (test_type IN ('hydrostatic','pneumatic','leak','service')),
  test_medium       text NOT NULL DEFAULT 'water'
                      CHECK (test_medium IN ('water','air','nitrogen','process_fluid','other')),
  design_pressure   numeric(10,2),
  test_pressure     numeric(10,2) NOT NULL,
  pressure_unit     text NOT NULL DEFAULT 'kPa'
                      CHECK (pressure_unit IN ('kPa','psi','bar','MPa')),
  hold_duration_min integer NOT NULL DEFAULT 30,
  test_date         date NOT NULL,
  test_start_time   time,
  test_end_time     time,
  initial_pressure  numeric(10,2),
  final_pressure    numeric(10,2),
  ambient_temp      text,
  result            text NOT NULL DEFAULT 'pending'
                      CHECK (result IN ('pending','pass','fail','conditional_pass')),
  failure_reason    text,
  inspector_name    text NOT NULL,
  witness_name      text,
  witness_company   text,
  reinspection_date date,
  notes             text,
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','submitted','approved','void')),
  created_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, test_number)
);

CREATE INDEX IF NOT EXISTS idx_pt_org     ON public.pressure_tests(organization_id);
CREATE INDEX IF NOT EXISTS idx_pt_project ON public.pressure_tests(project_id);
CREATE INDEX IF NOT EXISTS idx_pt_date    ON public.pressure_tests(test_date DESC);
CREATE INDEX IF NOT EXISTS idx_pt_result  ON public.pressure_tests(result);

ALTER TABLE public.pressure_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pt_select" ON public.pressure_tests;
DROP POLICY IF EXISTS "pt_insert" ON public.pressure_tests;
DROP POLICY IF EXISTS "pt_update" ON public.pressure_tests;
DROP POLICY IF EXISTS "pt_delete" ON public.pressure_tests;

CREATE POLICY "pt_select" ON public.pressure_tests FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "pt_insert" ON public.pressure_tests FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "pt_update" ON public.pressure_tests FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "pt_delete" ON public.pressure_tests FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

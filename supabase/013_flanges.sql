CREATE TABLE IF NOT EXISTS public.flange_joints (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  joint_number     text NOT NULL,           -- FJ-001
  line_number      text,                    -- P&ID line reference
  spool_id         uuid REFERENCES public.spools(id) ON DELETE SET NULL,
  flange_type      text NOT NULL DEFAULT 'weld_neck'
                     CHECK (flange_type IN ('weld_neck','slip_on','blind','socket_weld','lap_joint','threaded','orifice')),
  flange_rating    text,                    -- e.g. "ASME 150#", "PN40"
  nominal_size     text,                    -- e.g. "6 inch"
  gasket_type      text,                    -- e.g. "Spiral Wound", "Ring Joint", "Full Face"
  gasket_material  text,                    -- e.g. "316SS/Graphite"
  bolt_spec        text,                    -- e.g. "ASTM A193 B7"
  bolt_size        text,                    -- e.g. "3/4 inch x 3 inch"
  bolt_count       integer,
  nut_spec         text,                    -- e.g. "ASTM A194 2H"
  target_torque_nm numeric(8,2),            -- Newton-metres
  torque_unit      text DEFAULT 'Nm' CHECK (torque_unit IN ('Nm','ft-lb','in-lb')),
  torque_passes    integer DEFAULT 3,       -- number of torquing passes
  -- Execution
  assembled_by     text,
  assembly_date    date,
  torque_wrench_id text,                    -- wrench calibration ID
  torque_cert_date date,                    -- wrench cert expiry
  final_torque_nm  numeric(8,2),            -- actual achieved torque
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','assembled','torqued','inspected','leak_tested','accepted','rejected')),
  inspector_name   text,
  inspection_date  date,
  rejection_reason text,
  notes            text,
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, joint_number)
);

CREATE INDEX IF NOT EXISTS idx_flange_org     ON public.flange_joints(organization_id);
CREATE INDEX IF NOT EXISTS idx_flange_project ON public.flange_joints(project_id);
CREATE INDEX IF NOT EXISTS idx_flange_status  ON public.flange_joints(status);

ALTER TABLE public.flange_joints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flange_select" ON public.flange_joints;
DROP POLICY IF EXISTS "flange_insert" ON public.flange_joints;
DROP POLICY IF EXISTS "flange_update" ON public.flange_joints;
DROP POLICY IF EXISTS "flange_delete" ON public.flange_joints;

CREATE POLICY "flange_select" ON public.flange_joints FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "flange_insert" ON public.flange_joints FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "flange_update" ON public.flange_joints FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "flange_delete" ON public.flange_joints FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

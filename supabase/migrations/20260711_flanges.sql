-- Flange records linked to projects
CREATE TABLE IF NOT EXISTS public.flanges (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  flange_number    text        NOT NULL,
  flange_type      text        NOT NULL DEFAULT 'weld_neck'
                               CHECK (flange_type IN ('weld_neck','slip_on','blind','socket_weld','threaded','lap_joint','orifice')),
  pressure_class   text        NOT NULL DEFAULT '150'
                               CHECK (pressure_class IN ('150','300','600','900','1500','2500')),
  size_inches      numeric,
  material_spec    text,
  heat_number      text,       -- links to mtr_documents
  bolt_torque_spec text,
  gasket_type      text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','assembled','torqued','inspected','rejected')),
  inspector_id     uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  inspected_at     timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, flange_number)
);

ALTER TABLE public.flanges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flanges_org" ON public.flanges
  USING (organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());

CREATE INDEX IF NOT EXISTS idx_flanges_project ON public.flanges(project_id, status);
CREATE INDEX IF NOT EXISTS idx_flanges_heat ON public.flanges(heat_number) WHERE heat_number IS NOT NULL;

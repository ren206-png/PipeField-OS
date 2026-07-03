CREATE TABLE IF NOT EXISTS public.ncrs (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ncr_number       text NOT NULL,
  title            text NOT NULL,
  discipline       text NOT NULL DEFAULT 'piping'
                     CHECK (discipline IN ('piping','mechanical','electrical','instrumentation','civil','structural','welding','material','documentation','other')),
  severity         text NOT NULL DEFAULT 'major'
                     CHECK (severity IN ('minor','major','critical')),
  ncr_type         text NOT NULL DEFAULT 'workmanship'
                     CHECK (ncr_type IN ('workmanship','material','design','documentation','procedure','other')),
  description      text NOT NULL,
  location         text,
  drawing_ref      text,
  spec_ref         text,
  weld_id          uuid REFERENCES public.welds(id) ON DELETE SET NULL,
  root_cause       text,
  disposition      text CHECK (disposition IN ('use_as_is','repair','rework','reject','return_to_vendor')),
  disposition_notes text,
  corrective_action text,
  preventive_action text,
  raised_by        text NOT NULL,
  raised_date      date NOT NULL DEFAULT CURRENT_DATE,
  assigned_to      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  due_date         date,
  closed_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  closed_at        timestamptz,
  verified_by      text,
  verified_date    date,
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','under_review','disposition_pending','in_rework','verification_pending','closed','void')),
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, ncr_number)
);

CREATE INDEX IF NOT EXISTS idx_ncr_org      ON public.ncrs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ncr_project  ON public.ncrs(project_id);
CREATE INDEX IF NOT EXISTS idx_ncr_status   ON public.ncrs(status);
CREATE INDEX IF NOT EXISTS idx_ncr_severity ON public.ncrs(severity);

ALTER TABLE public.ncrs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ncr_select" ON public.ncrs;
DROP POLICY IF EXISTS "ncr_insert" ON public.ncrs;
DROP POLICY IF EXISTS "ncr_update" ON public.ncrs;
DROP POLICY IF EXISTS "ncr_delete" ON public.ncrs;

CREATE POLICY "ncr_select" ON public.ncrs FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "ncr_insert" ON public.ncrs FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "ncr_update" ON public.ncrs FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "ncr_delete" ON public.ncrs FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

CREATE TABLE IF NOT EXISTS public.rfis (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rfi_number       text NOT NULL,
  title            text NOT NULL,
  discipline       text NOT NULL DEFAULT 'piping'
                     CHECK (discipline IN ('piping','mechanical','electrical','instrumentation','civil','structural','general')),
  priority         text NOT NULL DEFAULT 'normal'
                     CHECK (priority IN ('low','normal','high','urgent')),
  question         text NOT NULL,
  background       text,
  drawing_refs     text,
  spec_refs        text,
  submitted_to     text,
  submitted_date   date,
  required_by_date date,
  answer           text,
  answered_by      text,
  answered_date    date,
  impact           text,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','under_review','answered','closed','void')),
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, rfi_number)
);

CREATE INDEX IF NOT EXISTS idx_rfi_org     ON public.rfis(organization_id);
CREATE INDEX IF NOT EXISTS idx_rfi_project ON public.rfis(project_id);
CREATE INDEX IF NOT EXISTS idx_rfi_status  ON public.rfis(status);

ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfi_select" ON public.rfis;
DROP POLICY IF EXISTS "rfi_insert" ON public.rfis;
DROP POLICY IF EXISTS "rfi_update" ON public.rfis;
DROP POLICY IF EXISTS "rfi_delete" ON public.rfis;

CREATE POLICY "rfi_select" ON public.rfis FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "rfi_insert" ON public.rfis FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "rfi_update" ON public.rfis FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "rfi_delete" ON public.rfis FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

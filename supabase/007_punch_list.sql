CREATE TABLE IF NOT EXISTS public.punch_items (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_number      text NOT NULL,
  discipline       text NOT NULL DEFAULT 'piping'
                     CHECK (discipline IN ('piping','mechanical','electrical','instrumentation','civil','structural','insulation','painting','other')),
  category         text NOT NULL DEFAULT 'A'
                     CHECK (category IN ('A','B','C')),
  description      text NOT NULL,
  location         text,
  drawing_ref      text,
  raised_by        text,
  assigned_to      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  due_date         date,
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','in_progress','ready_for_inspection','closed','voided')),
  resolution_notes text,
  closed_by        uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  closed_at        timestamptz,
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_org     ON public.punch_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_punch_project ON public.punch_items(project_id);
CREATE INDEX IF NOT EXISTS idx_punch_status  ON public.punch_items(status);

ALTER TABLE public.punch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "punch_select" ON public.punch_items;
DROP POLICY IF EXISTS "punch_insert" ON public.punch_items;
DROP POLICY IF EXISTS "punch_update" ON public.punch_items;
DROP POLICY IF EXISTS "punch_delete" ON public.punch_items;

CREATE POLICY "punch_select" ON public.punch_items FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "punch_insert" ON public.punch_items FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "punch_update" ON public.punch_items FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "punch_delete" ON public.punch_items FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

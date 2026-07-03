CREATE TABLE IF NOT EXISTS public.itps (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  itp_number       text NOT NULL,           -- ITP-001
  title            text NOT NULL,           -- e.g. "Piping Fabrication ITP"
  revision         text DEFAULT 'A',
  discipline       text NOT NULL DEFAULT 'piping',
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','issued','approved','superseded')),
  approved_by      text,
  approved_date    date,
  description      text,
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, itp_number)
);

CREATE TABLE IF NOT EXISTS public.itp_items (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  itp_id              uuid NOT NULL REFERENCES public.itps(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_number         text NOT NULL,         -- 1, 2, 3 or 1.1, 1.2
  activity            text NOT NULL,         -- e.g. "Material Verification"
  description         text,                  -- detail of what is checked
  reference_doc       text,                  -- spec/code reference e.g. "ASME B31.3 §328"
  acceptance_criteria text,                  -- what pass looks like
  -- Inspection levels per party
  contractor_level    text NOT NULL DEFAULT 'perform'
                        CHECK (contractor_level IN ('perform','monitor','review','n_a')),
  inspector_level     text NOT NULL DEFAULT 'witness'
                        CHECK (inspector_level IN ('hold','witness','review','monitor','n_a')),
  client_level        text NOT NULL DEFAULT 'review'
                        CHECK (client_level IN ('hold','witness','review','monitor','n_a')),
  frequency           text DEFAULT '100%',   -- e.g. "100%", "10%", "Random"
  record_required     text DEFAULT 'yes'
                        CHECK (record_required IN ('yes','no')),
  record_type         text,                  -- e.g. "Weld Log", "NDE Report", "MTR"
  -- Actual sign-off
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','complete','not_applicable')),
  completed_date      date,
  completed_by        text,
  remarks             text,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itp_org        ON public.itps(organization_id);
CREATE INDEX IF NOT EXISTS idx_itp_project    ON public.itps(project_id);
CREATE INDEX IF NOT EXISTS idx_itp_item_itp   ON public.itp_items(itp_id);
CREATE INDEX IF NOT EXISTS idx_itp_item_proj  ON public.itp_items(project_id);

ALTER TABLE public.itps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itp_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "itp_select"      ON public.itps;
DROP POLICY IF EXISTS "itp_insert"      ON public.itps;
DROP POLICY IF EXISTS "itp_update"      ON public.itps;
DROP POLICY IF EXISTS "itp_item_select" ON public.itp_items;
DROP POLICY IF EXISTS "itp_item_insert" ON public.itp_items;
DROP POLICY IF EXISTS "itp_item_update" ON public.itp_items;
DROP POLICY IF EXISTS "itp_item_delete" ON public.itp_items;

CREATE POLICY "itp_select" ON public.itps FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "itp_insert" ON public.itps FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "itp_update" ON public.itps FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());

CREATE POLICY "itp_item_select" ON public.itp_items FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "itp_item_insert" ON public.itp_items FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "itp_item_update" ON public.itp_items FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "itp_item_delete" ON public.itp_items FOR DELETE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());

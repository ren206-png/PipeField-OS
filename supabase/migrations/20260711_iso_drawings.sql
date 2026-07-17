CREATE TABLE IF NOT EXISTS public.iso_drawings (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drawing_number   text        NOT NULL,
  revision         text        NOT NULL DEFAULT 'A',
  title            text,
  storage_path     text        NOT NULL,   -- Supabase Storage path
  file_type        text        NOT NULL DEFAULT 'pdf' CHECK (file_type IN ('pdf','png','jpg','jpeg')),
  page_count       integer     NOT NULL DEFAULT 1,
  uploaded_by      uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, drawing_number, revision)
);

ALTER TABLE public.iso_drawings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iso_drawings_org" ON public.iso_drawings
  USING (organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());

CREATE INDEX IF NOT EXISTS idx_iso_drawings_project ON public.iso_drawings(project_id);

-- Weld pins: x_pct, y_pct are 0-100 percent coordinates on the drawing
CREATE TABLE IF NOT EXISTS public.iso_weld_pins (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  drawing_id       uuid        NOT NULL REFERENCES public.iso_drawings(id) ON DELETE CASCADE,
  weld_id          uuid        REFERENCES public.welds(id) ON DELETE SET NULL,
  weld_number_label text       NOT NULL,   -- display label even if weld_id is null
  x_pct            numeric     NOT NULL CHECK (x_pct BETWEEN 0 AND 100),
  y_pct            numeric     NOT NULL CHECK (y_pct BETWEEN 0 AND 100),
  page_number      integer     NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iso_weld_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iso_weld_pins_org" ON public.iso_weld_pins
  USING (organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());

CREATE INDEX IF NOT EXISTS idx_iso_weld_pins_drawing ON public.iso_weld_pins(drawing_id);

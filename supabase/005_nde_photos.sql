-- ============================================================
-- 005_nde_photos.sql
-- Creates nde_inspections and weld_photos tables.
-- Run AFTER schema.sql and 001_platform_admin.sql
-- ============================================================

-- ── NDE Inspections ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nde_inspections (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  weld_id          uuid NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  inspection_type  text NOT NULL CHECK (inspection_type IN ('RT','UT','PT','MT','VT','PMI','HT')),
  result           text NOT NULL DEFAULT 'pending'
                     CHECK (result IN ('pending','pass','fail','repair','retest')),
  inspector_name   text,
  inspection_date  date,
  report_number    text,
  acceptance_code  text,
  defect_type      text,
  defect_location  text,
  film_location    text,
  repair_weld_id   uuid REFERENCES public.welds(id) ON DELETE SET NULL,
  notes            text,
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nde_org    ON public.nde_inspections(organization_id);
CREATE INDEX IF NOT EXISTS idx_nde_weld   ON public.nde_inspections(weld_id);
CREATE INDEX IF NOT EXISTS idx_nde_proj   ON public.nde_inspections(project_id);

ALTER TABLE public.nde_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nde_select" ON public.nde_inspections;
DROP POLICY IF EXISTS "nde_insert" ON public.nde_inspections;
DROP POLICY IF EXISTS "nde_update" ON public.nde_inspections;
DROP POLICY IF EXISTS "nde_delete" ON public.nde_inspections;

CREATE POLICY "nde_select" ON public.nde_inspections FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "nde_insert" ON public.nde_inspections FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "nde_update" ON public.nde_inspections FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "nde_delete" ON public.nde_inspections FOR DELETE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());

-- ── Weld Photos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weld_photos (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weld_id         uuid NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  public_url      text NOT NULL,
  file_name       text NOT NULL,
  file_size       integer,
  caption         text,
  uploaded_by     uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weld_photos_weld ON public.weld_photos(weld_id);
CREATE INDEX IF NOT EXISTS idx_weld_photos_org  ON public.weld_photos(organization_id);

ALTER TABLE public.weld_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weld_photos_select" ON public.weld_photos;
DROP POLICY IF EXISTS "weld_photos_insert" ON public.weld_photos;
DROP POLICY IF EXISTS "weld_photos_delete" ON public.weld_photos;
DROP POLICY IF EXISTS "weld_photos_org_isolation" ON public.weld_photos;

CREATE POLICY "weld_photos_select" ON public.weld_photos FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "weld_photos_insert" ON public.weld_photos FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "weld_photos_delete" ON public.weld_photos FOR DELETE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());

-- ── Supabase Storage bucket for weld photos ───────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'weld-photos',
  'weld-photos',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org_members_upload_weld_photos"  ON storage.objects;
DROP POLICY IF EXISTS "org_members_view_weld_photos"    ON storage.objects;
DROP POLICY IF EXISTS "uploaders_delete_weld_photos"    ON storage.objects;

CREATE POLICY "org_members_upload_weld_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'weld-photos');

CREATE POLICY "org_members_view_weld_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'weld-photos');

CREATE POLICY "uploaders_delete_weld_photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'weld-photos');

-- ── Welders cert_expiry index (for fast expiry queries) ───────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'welders'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_welders_cert_expiry ON public.welders(cert_expiry)';
  END IF;
END
$$;

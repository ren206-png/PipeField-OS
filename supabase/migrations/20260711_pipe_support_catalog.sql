-- Pipe support component type catalog
-- Tenant-scoped, additive only, safe to re-run (idempotent)

CREATE TABLE IF NOT EXISTS public.pipe_support_catalog (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  component_name      text        NOT NULL,
  component_code      text        NOT NULL,  -- e.g. FPS-RIGID-01
  visual_description  text,                  -- 2-3 sentence visual ID text; human-reviewed before insert
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, component_code)
);

ALTER TABLE public.pipe_support_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipe_support_catalog_org" ON public.pipe_support_catalog
  USING (organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());

CREATE INDEX IF NOT EXISTS idx_pipe_support_catalog_org
  ON public.pipe_support_catalog(organization_id);

-- Photo identification audit log (append-only, no UPDATE/DELETE policies)
CREATE TABLE IF NOT EXISTS public.support_photo_identifications (
  id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id             uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  client_photo_id     text        NOT NULL,  -- device-generated UUID for deduplication
  captured_at_client  timestamptz,
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  result_status       text        CHECK (result_status IN ('MATCH','UNIDENTIFIED','PHOTO_EXPIRED','ERROR')),
  matched_catalog_id  uuid        REFERENCES public.pipe_support_catalog(id) ON DELETE SET NULL,
  confidence          numeric,
  visual_indicators   jsonb,
  storage_path        text,       -- Supabase Storage path
  delete_after        timestamptz NOT NULL,  -- upload + 7 days
  deleted_at          timestamptz,           -- set by deletion job
  UNIQUE (organization_id, client_photo_id)
);

ALTER TABLE public.support_photo_identifications ENABLE ROW LEVEL SECURITY;

-- Read: org members see their own org's identifications
CREATE POLICY "support_photo_id_org_read" ON public.support_photo_identifications
  FOR SELECT USING (organization_id = public.my_org_id());

-- Insert: org members can insert (endpoint writes on behalf of user)
CREATE POLICY "support_photo_id_org_insert" ON public.support_photo_identifications
  FOR INSERT WITH CHECK (organization_id = public.my_org_id());

-- NO UPDATE POLICY. NO DELETE POLICY. Append-only audit log.
-- (deletion job uses service role which bypasses RLS)

CREATE INDEX IF NOT EXISTS idx_support_photo_id_org
  ON public.support_photo_identifications(organization_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_photo_id_client
  ON public.support_photo_identifications(organization_id, client_photo_id);

CREATE INDEX IF NOT EXISTS idx_support_photo_id_delete_after
  ON public.support_photo_identifications(delete_after)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.turnover_packages (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_name     text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','generating','complete','failed')),
  progress_pct     integer     NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  content_hash     text,       -- SHA-256 of assembled content for immutability verification
  gap_report       jsonb       NOT NULL DEFAULT '{}',  -- completeness gaps at generation time
  storage_path     text,       -- Supabase Storage path once uploaded
  generated_by     uuid        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  generated_at     timestamptz,
  error_message    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.turnover_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "turnover_packages_org" ON public.turnover_packages
  USING (organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());
CREATE INDEX IF NOT EXISTS idx_turnover_packages_project
  ON public.turnover_packages(project_id, created_at DESC);

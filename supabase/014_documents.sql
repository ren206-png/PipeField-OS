-- Storage bucket for project documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  false,
  52428800,  -- 50MB max per file
  ARRAY[
    'application/pdf',
    'image/jpeg','image/jpg','image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain','text/csv',
    'application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "docs_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-documents');
CREATE POLICY "docs_view" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-documents');
CREATE POLICY "docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-documents');

-- Documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title            text NOT NULL,
  document_number  text,                    -- e.g. "DWG-P-001", "SPEC-15000"
  document_type    text NOT NULL DEFAULT 'other'
                     CHECK (document_type IN (
                       'drawing','specification','procedure','certificate',
                       'report','datasheet','itp','correspondence',
                       'submittal','method_statement','risk_assessment','other'
                     )),
  revision         text DEFAULT 'A',        -- Rev A, Rev B, 0, 1, 2...
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','issued_for_review','issued_for_construction','approved','superseded','void')),
  discipline       text DEFAULT 'piping'
                     CHECK (discipline IN ('piping','mechanical','electrical','instrumentation','civil','structural','general')),
  storage_path     text NOT NULL,           -- path in Supabase Storage
  file_name        text NOT NULL,
  file_size        bigint,                  -- bytes
  mime_type        text,
  description      text,
  tags             text,                    -- comma-separated tags
  -- Links to other records (optional)
  linked_weld_id   uuid REFERENCES public.welds(id) ON DELETE SET NULL,
  linked_spool_id  uuid REFERENCES public.spools(id) ON DELETE SET NULL,
  linked_ncr_id    uuid REFERENCES public.ncrs(id) ON DELETE SET NULL,
  linked_rfi_id    uuid REFERENCES public.rfis(id) ON DELETE SET NULL,
  uploaded_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_org      ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_docs_project  ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_docs_type     ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_docs_status   ON public.documents(status);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_select" ON public.documents;
DROP POLICY IF EXISTS "docs_insert" ON public.documents;
DROP POLICY IF EXISTS "docs_update" ON public.documents;
DROP POLICY IF EXISTS "docs_delete" ON public.documents;

CREATE POLICY "docs_select" ON public.documents FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "docs_insert" ON public.documents FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "docs_update" ON public.documents FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "docs_delete" ON public.documents FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

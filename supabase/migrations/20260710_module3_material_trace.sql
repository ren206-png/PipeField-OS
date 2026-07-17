-- Module 3: Material Traceability
-- Adds MTR document attachments table and batch-recall SQL function

-- MTR document attachments
CREATE TABLE IF NOT EXISTS public.mtr_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mtr_id          UUID NOT NULL REFERENCES public.mtrs(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER,
  document_type   TEXT NOT NULL DEFAULT 'mtr_certificate'
                  CHECK (document_type IN ('mtr_certificate','test_report','coc','other')),
  uploaded_by     UUID REFERENCES public.user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mtr_docs_mtr ON public.mtr_documents(mtr_id);
CREATE INDEX IF NOT EXISTS idx_mtr_docs_org ON public.mtr_documents(organization_id);

ALTER TABLE public.mtr_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mtr_docs_org" ON public.mtr_documents
  FOR ALL USING (organization_id = get_my_org_id());

-- Batch-recall function: given a heat number or filler batch,
-- return every weld that used it (across base_metal_heat_a, _b, filler_batch_number)
CREATE OR REPLACE FUNCTION public.batch_recall(
  p_organization_id UUID,
  p_heat_or_batch   TEXT
) RETURNS TABLE (
  weld_id           UUID,
  weld_id_number    TEXT,
  project_id        UUID,
  project_name      TEXT,
  spool_id          UUID,
  spool_number      TEXT,
  weld_status       TEXT,
  heat_role         TEXT,
  welder_stamp      TEXT,
  weld_date         DATE
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT w.id, w.weld_id_number, w.project_id, p.name,
         w.spool_id, s.spool_number, w.status, 'base_metal_a', w.welder_stamp, w.weld_date
  FROM public.welds w
  JOIN public.projects p ON p.id = w.project_id
  LEFT JOIN public.spools s ON s.id = w.spool_id
  WHERE w.organization_id = p_organization_id
    AND w.base_metal_heat_a = p_heat_or_batch

  UNION ALL

  SELECT w.id, w.weld_id_number, w.project_id, p.name,
         w.spool_id, s.spool_number, w.status, 'base_metal_b', w.welder_stamp, w.weld_date
  FROM public.welds w
  JOIN public.projects p ON p.id = w.project_id
  LEFT JOIN public.spools s ON s.id = w.spool_id
  WHERE w.organization_id = p_organization_id
    AND w.base_metal_heat_b = p_heat_or_batch

  UNION ALL

  SELECT w.id, w.weld_id_number, w.project_id, p.name,
         w.spool_id, s.spool_number, w.status, 'filler_batch', w.welder_stamp, w.weld_date
  FROM public.welds w
  JOIN public.projects p ON p.id = w.project_id
  LEFT JOIN public.spools s ON s.id = w.spool_id
  WHERE w.organization_id = p_organization_id
    AND w.filler_batch_number = p_heat_or_batch

  ORDER BY project_name, spool_number;
$$;

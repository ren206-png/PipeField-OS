-- ============================================================
-- Migration: 20260815_mtr_cert_type
-- Add EN 10204 certificate type enum and document hash to mtrs.
-- Also adds PMI (Positive Material Identification) record table.
-- Also adds required_cert_type to projects.
-- ============================================================

-- ── EN 10204 cert type on mtrs ────────────────────────────────
ALTER TABLE public.mtrs
  ADD COLUMN IF NOT EXISTS cert_type_enum TEXT
    CHECK (cert_type_enum IN ('2.1','2.2','3.1','3.2')),
    -- 2.1 = Declaration of compliance (manufacturer)
    -- 2.2 = Test report (manufacturer)
    -- 3.1 = Inspection certificate (manufacturer's authorised inspector)
    -- 3.2 = Inspection certificate (independent 3rd-party inspector)
  ADD COLUMN IF NOT EXISTS document_sha256     TEXT,
    -- SHA-256 hex of uploaded certificate PDF bytes
  ADD COLUMN IF NOT EXISTS document_size_bytes BIGINT;
    -- File size for integrity check

COMMENT ON COLUMN public.mtrs.cert_type_enum IS
  'EN 10204 certificate type: 2.1, 2.2, 3.1, or 3.2. '
  'Free-text cert_type column is retained for backwards compatibility.';
COMMENT ON COLUMN public.mtrs.document_sha256 IS
  'SHA-256 hex digest of the certificate PDF uploaded to storage. '
  'Computed client-side before upload; verified server-side after upload.';

-- ── Required cert type on projects ───────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS required_cert_type TEXT
    DEFAULT 'none'
    CHECK (required_cert_type IN ('2.1','2.2','3.1','3.2','none'));

COMMENT ON COLUMN public.projects.required_cert_type IS
  'Minimum EN 10204 certificate type required for all MTRs on this project. '
  'Enforced when PFOS_MATERIAL_TRACE flag is enabled.';

-- ── PMI (Positive Material Identification) records ───────────
CREATE TABLE IF NOT EXISTS public.pmi_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  weld_id          UUID REFERENCES public.welds(id) ON DELETE CASCADE,
  heat_number      TEXT,
  method           TEXT NOT NULL CHECK (method IN ('XRF','OES','wet_chem','portable_XRF')),
  result_alloy     TEXT,     -- e.g. 'A312 TP316L'
  result_data      JSONB,    -- raw elemental percentages
  performed_by     TEXT,
  performed_at     TIMESTAMPTZ,
  pass             BOOLEAN,
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pmi_records_org_id_idx     ON public.pmi_records(org_id);
CREATE INDEX IF NOT EXISTS pmi_records_project_id_idx ON public.pmi_records(project_id);
CREATE INDEX IF NOT EXISTS pmi_records_weld_id_idx    ON public.pmi_records(weld_id);
CREATE INDEX IF NOT EXISTS pmi_records_heat_number_idx ON public.pmi_records(heat_number);

ALTER TABLE public.pmi_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmi_records_org_access" ON public.pmi_records
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.pmi_records IS
  'Positive Material Identification (PMI) test records. '
  'Links to welds and heat numbers for full material traceability.';

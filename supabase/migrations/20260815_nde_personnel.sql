-- ============================================================
-- Migration: 20260815_nde_personnel
-- NDE personnel qualification model.
-- Links inspectors to their method certifications (SNT-TC-1A,
-- CSWIP, PCN, COFREND) and tracks expiry + vision test dates.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.nde_personnel (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  employee_id          TEXT,
  certification_body   TEXT NOT NULL
    CHECK (certification_body IN ('SNT-TC-1A','CSWIP','PCN','COFREND','ASNT-CP-189','other')),
  cert_number          TEXT,
  methods              TEXT[] NOT NULL,
    -- ARRAY['RT','UT','MT','PT','VT'] — methods this person is certified for
  level                TEXT NOT NULL CHECK (level IN ('I','II','III')),
    -- Level I: perform only; Level II: perform + interpret; Level III: can certify others
  expiry_date          DATE,
    -- Certification expiry; NULL if no expiry (some schemes are indefinite)
  employer             TEXT,
    -- Required for SNT-TC-1A (employer-based certification scheme)
  vision_test_date     DATE,
    -- Most recent near-vision test (Jaeger No. 2 or equivalent)
    -- Must be within 12 months per ASME Sec V T-120
  active               BOOLEAN NOT NULL DEFAULT true,
  notes                TEXT,
  created_by           UUID REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nde_personnel_org_id_idx ON public.nde_personnel(org_id);
CREATE INDEX IF NOT EXISTS nde_personnel_methods_idx ON public.nde_personnel USING GIN(methods);

-- Link NDE selections to the inspector assigned
ALTER TABLE public.nde_selections
  ADD COLUMN IF NOT EXISTS assigned_to          UUID REFERENCES public.nde_personnel(id),
  ADD COLUMN IF NOT EXISTS inspector_level      TEXT,
    -- Level at time of assignment (denormalised for historical accuracy)
  ADD COLUMN IF NOT EXISTS inspector_cert_body  TEXT;
    -- Cert body at time of assignment

ALTER TABLE public.nde_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nde_personnel_org_access" ON public.nde_personnel
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.nde_personnel IS
  'NDE inspector qualification records. '
  'Levels: I = perform only; II = perform + interpret; III = full authority. '
  'Vision test date must be within 12 months per ASME Sec V Art. 1 T-120.';
COMMENT ON COLUMN public.nde_personnel.employer IS
  'Required for SNT-TC-1A: certification is employer-based and must be re-issued on change of employer.';

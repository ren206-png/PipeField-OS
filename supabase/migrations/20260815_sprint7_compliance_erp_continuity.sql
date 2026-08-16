-- ============================================================
-- PipeField OS — Sprint 7: Compliance, ERP & Continuity
-- Migration: 20260815_sprint7_compliance_erp_continuity.sql
-- Idempotent (safe to re-run)
-- ============================================================

-- ============================================================
-- SECTION 1: welder_continuity table
-- Tracks 6-month continuity status per welder/process/position
-- ============================================================

CREATE TABLE IF NOT EXISTS public.welder_continuity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  welder_id UUID NOT NULL REFERENCES public.welders(id) ON DELETE CASCADE,
  process VARCHAR(50) NOT NULL,
  position VARCHAR(10) NOT NULL,
  standard VARCHAR(50) NOT NULL DEFAULT 'AWS D1.1',
  last_weld_date DATE NOT NULL,
  expires_date DATE NOT NULL,
  continuity_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'CLOSE_TO_EXPIRY', 'EXPIRED'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (welder_id, process, position, standard)
);

ALTER TABLE public.welder_continuity ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='welder_continuity' AND policyname='welder_continuity_org_select') THEN
    CREATE POLICY welder_continuity_org_select ON public.welder_continuity FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='welder_continuity' AND policyname='welder_continuity_org_insert') THEN
    CREATE POLICY welder_continuity_org_insert ON public.welder_continuity FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='welder_continuity' AND policyname='welder_continuity_org_update') THEN
    CREATE POLICY welder_continuity_org_update ON public.welder_continuity FOR UPDATE TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- SECTION 2: update_welder_continuity() trigger function
-- Fires AFTER INSERT on welds; upserts continuity record
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_welder_continuity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.welder_id IS NOT NULL AND NEW.process IS NOT NULL AND NEW.position IS NOT NULL THEN
    INSERT INTO public.welder_continuity (
      organization_id,
      welder_id,
      process,
      position,
      standard,
      last_weld_date,
      expires_date,
      continuity_status,
      updated_at
    )
    VALUES (
      NEW.organization_id,
      NEW.welder_id,
      NEW.process,
      NEW.position,
      'AWS D1.1',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '180 days',
      'ACTIVE',
      now()
    )
    ON CONFLICT (welder_id, process, position, standard) DO UPDATE
      SET last_weld_date = CURRENT_DATE,
          expires_date = CURRENT_DATE + INTERVAL '180 days',
          continuity_status = 'ACTIVE',
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_update_welder_continuity
  AFTER INSERT ON public.welds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_welder_continuity();

-- ============================================================
-- SECTION 3: compliance_standards table
-- Global reference data — no organization_id
-- ============================================================

CREATE TABLE IF NOT EXISTS public.compliance_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_name VARCHAR(50) NOT NULL,
  standard_edition VARCHAR(20) NOT NULL,
  description TEXT,
  scope TEXT,
  reference_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (standard_name, standard_edition)
);

ALTER TABLE public.compliance_standards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='compliance_standards' AND policyname='compliance_standards_authenticated_select') THEN
    CREATE POLICY compliance_standards_authenticated_select ON public.compliance_standards FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

INSERT INTO public.compliance_standards (standard_name, standard_edition, description, scope, reference_url) VALUES
  ('AWS_D1_1', '2025', 'Structural Welding Code — Steel', 'Structural steel fabrication and erection; referenced by IBC and AISC 360', 'https://www.aws.org/standards/detail/aws-d1-1-structural-welding-code-steel'),
  ('AWS_D1_1', '2020', 'Structural Welding Code — Steel (2020)', 'Structural steel fabrication and erection', 'https://www.aws.org/standards/detail/aws-d1-1-structural-welding-code-steel'),
  ('ASME_IX', '2023', 'ASME Boiler and Pressure Vessel Code Section IX — Welding, Brazing, and Fusing Qualifications', 'Pressure vessels and boilers', 'https://www.asme.org/codes-standards/find-codes-standards/bpvc-ix-bpvc-section-ix-welding-brazing-fusing-qualifications'),
  ('API_1104', '2021', 'API Standard 1104 — Welding of Pipelines and Related Facilities', 'Pipeline construction and repair', 'https://www.api.org/products-and-services/standards/important-standards-announcements/standard-1104')
ON CONFLICT (standard_name, standard_edition) DO NOTHING;

-- ============================================================
-- SECTION 4: inspection_templates table
-- Global reference data tied to compliance_standards
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID REFERENCES public.compliance_standards(id),
  inspection_type VARCHAR(50) NOT NULL, -- 'VISUAL', 'RADIOGRAPHIC', 'ULTRASONIC', 'MAGNETIC_PARTICLE'
  required_criteria JSONB,
  acceptance_criteria TEXT,
  version VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (standard_id, inspection_type)
);

ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inspection_templates' AND policyname='inspection_templates_authenticated_select') THEN
    CREATE POLICY inspection_templates_authenticated_select ON public.inspection_templates FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

-- Seed AWS D1.1:2025 — VISUAL
INSERT INTO public.inspection_templates (standard_id, inspection_type, required_criteria, acceptance_criteria, version)
SELECT cs.id, 'VISUAL',
  '[{"criterion":"No visible cracks","pass_requirement":"OK"},{"criterion":"No undercut exceeding 1/32 in. (0.8 mm)","pass_requirement":"OK"},{"criterion":"Spatter minimal and removable","pass_requirement":"OK"},{"criterion":"Profile consistent with approved design","pass_requirement":"OK"}]'::jsonb,
  'Per AWS D1.1 Section 6.15.1 (Visual Examination)',
  '2025'
FROM public.compliance_standards cs WHERE cs.standard_name = 'AWS_D1_1' AND cs.standard_edition = '2025'
ON CONFLICT (standard_id, inspection_type) DO NOTHING;

-- Seed AWS D1.1:2025 — RADIOGRAPHIC
INSERT INTO public.inspection_templates (standard_id, inspection_type, required_criteria, acceptance_criteria, version)
SELECT cs.id, 'RADIOGRAPHIC',
  '[{"criterion":"No cracks or incomplete fusion","pass_requirement":"OK"},{"criterion":"No porosity exceeding limits in Table 6.1","pass_requirement":"OK"},{"criterion":"No slag inclusions exceeding limits","pass_requirement":"OK"},{"criterion":"Image quality indicator (IQI) meets 2-2T requirement","pass_requirement":"OK"}]'::jsonb,
  'Per AWS D1.1 Section 6.12 (Radiographic Testing)',
  '2025'
FROM public.compliance_standards cs WHERE cs.standard_name = 'AWS_D1_1' AND cs.standard_edition = '2025'
ON CONFLICT (standard_id, inspection_type) DO NOTHING;

-- Seed AWS D1.1:2025 — ULTRASONIC
INSERT INTO public.inspection_templates (standard_id, inspection_type, required_criteria, acceptance_criteria, version)
SELECT cs.id, 'ULTRASONIC',
  '[{"criterion":"No reflectors exceeding Class D limits","pass_requirement":"OK"},{"criterion":"Scanning coverage meets 100% of weld volume","pass_requirement":"OK"},{"criterion":"Calibration verified before and after testing","pass_requirement":"OK"},{"criterion":"UT technician qualified per AWS QC1 or equivalent","pass_requirement":"OK"}]'::jsonb,
  'Per AWS D1.1 Section 6.13 (Ultrasonic Testing)',
  '2025'
FROM public.compliance_standards cs WHERE cs.standard_name = 'AWS_D1_1' AND cs.standard_edition = '2025'
ON CONFLICT (standard_id, inspection_type) DO NOTHING;

-- ============================================================
-- SECTION 5: weld_qualifications table
-- AWS D1.1 Qualification Test Records per welder
-- ============================================================

CREATE TABLE IF NOT EXISTS public.weld_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  welder_id UUID NOT NULL REFERENCES public.welders(id) ON DELETE CASCADE,
  standard_id UUID NOT NULL REFERENCES public.compliance_standards(id),
  process VARCHAR(50),    -- 'SMAW','GMAW','FCAW','SAW'
  position VARCHAR(10),   -- '1G','2G','3G','4G'
  base_metal_group VARCHAR(50),
  thickness_range VARCHAR(50),
  qualification_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  pqr_reference VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE','EXPIRED','RENEWED'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weld_qualifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weld_qualifications' AND policyname='weld_qualifications_org_select') THEN
    CREATE POLICY weld_qualifications_org_select ON public.weld_qualifications FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weld_qualifications' AND policyname='weld_qualifications_org_insert') THEN
    CREATE POLICY weld_qualifications_org_insert ON public.weld_qualifications FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weld_qualifications' AND policyname='weld_qualifications_org_update') THEN
    CREATE POLICY weld_qualifications_org_update ON public.weld_qualifications FOR UPDATE TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- SECTION 6: weld_inspections table
-- Inspection records for individual welds
-- ============================================================

CREATE TABLE IF NOT EXISTS public.weld_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weld_id UUID NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  inspection_template_id UUID REFERENCES public.inspection_templates(id),
  inspector_id UUID REFERENCES auth.users(id),
  inspection_type VARCHAR(50), -- 'VISUAL','RADIOGRAPHIC','ULTRASONIC','MAGNETIC_PARTICLE'
  findings JSONB,  -- { "criterion_results": [...], "notes": "..." }
  defects JSONB,   -- [{ "type": "CRACK", "location": "...", "severity": "..." }]
  pass_fail VARCHAR(20), -- 'PASS','FAIL','CONDITIONAL'
  inspection_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  report_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weld_inspections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weld_inspections' AND policyname='weld_inspections_org_select') THEN
    CREATE POLICY weld_inspections_org_select ON public.weld_inspections FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weld_inspections' AND policyname='weld_inspections_org_insert') THEN
    CREATE POLICY weld_inspections_org_insert ON public.weld_inspections FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weld_inspections' AND policyname='weld_inspections_org_update') THEN
    CREATE POLICY weld_inspections_org_update ON public.weld_inspections FOR UPDATE TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- SECTION 7: spool_qr_codes table
-- QR code records linked to spools
-- ============================================================

CREATE TABLE IF NOT EXISTS public.spool_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  spool_id UUID NOT NULL REFERENCES public.spools(id) ON DELETE CASCADE,
  qr_code_id VARCHAR(100) NOT NULL,
  storage_path TEXT, -- path in Supabase Storage
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (qr_code_id)
);

ALTER TABLE public.spool_qr_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='spool_qr_codes' AND policyname='spool_qr_codes_org_select') THEN
    CREATE POLICY spool_qr_codes_org_select ON public.spool_qr_codes FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='spool_qr_codes' AND policyname='spool_qr_codes_org_insert') THEN
    CREATE POLICY spool_qr_codes_org_insert ON public.spool_qr_codes FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- SECTION 8: erp_connectors table
-- ERP integration configuration per organization
-- erp_api_key_encrypted stores the key encrypted at app layer
-- ============================================================

CREATE TABLE IF NOT EXISTS public.erp_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  erp_type VARCHAR(50) NOT NULL, -- 'MIE_TRAK','SYSPRO','DIGIT','JOBBOSS','GENERIC'
  display_name VARCHAR(100),
  erp_host VARCHAR(255) NOT NULL,
  erp_api_url TEXT NOT NULL,
  erp_api_key_encrypted TEXT, -- encrypted at application layer before storage
  auth_method VARCHAR(20) NOT NULL DEFAULT 'API_KEY', -- 'API_KEY','OAUTH2','BASIC'
  test_status VARCHAR(20) NOT NULL DEFAULT 'NOT_TESTED', -- 'CONNECTED','FAILED','NOT_TESTED'
  last_sync TIMESTAMPTZ,
  sync_frequency VARCHAR(20) NOT NULL DEFAULT 'ON_DEMAND', -- 'HOURLY','ON_DEMAND'
  auto_post_welds BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.erp_connectors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='erp_connectors' AND policyname='erp_connectors_org_select') THEN
    CREATE POLICY erp_connectors_org_select ON public.erp_connectors FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='erp_connectors' AND policyname='erp_connectors_org_insert') THEN
    CREATE POLICY erp_connectors_org_insert ON public.erp_connectors FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='erp_connectors' AND policyname='erp_connectors_org_update') THEN
    CREATE POLICY erp_connectors_org_update ON public.erp_connectors FOR UPDATE TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- SECTION 9: erp_job_mappings table
-- Maps ERP jobs to PipeField projects
-- ============================================================

CREATE TABLE IF NOT EXISTS public.erp_job_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES public.erp_connectors(id) ON DELETE CASCADE,
  erp_job_id VARCHAR(100) NOT NULL,
  pipefield_project_id UUID REFERENCES public.projects(id),
  customer_name VARCHAR(255),
  material_spec VARCHAR(255),
  thickness VARCHAR(50),
  specification VARCHAR(255),
  schedule_due_date DATE,
  urgency VARCHAR(20) DEFAULT 'MEDIUM', -- 'LOW','MEDIUM','HIGH'
  raw_erp_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connector_id, erp_job_id)
);

ALTER TABLE public.erp_job_mappings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='erp_job_mappings' AND policyname='erp_job_mappings_org_select') THEN
    CREATE POLICY erp_job_mappings_org_select ON public.erp_job_mappings FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='erp_job_mappings' AND policyname='erp_job_mappings_org_insert') THEN
    CREATE POLICY erp_job_mappings_org_insert ON public.erp_job_mappings FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='erp_job_mappings' AND policyname='erp_job_mappings_org_update') THEN
    CREATE POLICY erp_job_mappings_org_update ON public.erp_job_mappings FOR UPDATE TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- SECTION 10: erp_weld_exports table
-- Tracks export attempts of welds to ERP systems
-- ============================================================

CREATE TABLE IF NOT EXISTS public.erp_weld_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weld_id UUID NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES public.erp_connectors(id) ON DELETE CASCADE,
  erp_job_id VARCHAR(100),
  export_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'SUCCESS','FAILED','PENDING'
  export_payload JSONB,
  exported_at TIMESTAMPTZ,
  error_message TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.erp_weld_exports ENABLE ROW LEVEL SECURITY;

-- Org members can SELECT; system service role handles INSERT/UPDATE
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='erp_weld_exports' AND policyname='erp_weld_exports_org_select') THEN
    CREATE POLICY erp_weld_exports_org_select ON public.erp_weld_exports FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- SECTION 11: ndt_requirements table
-- NDT rules per project (or org-wide defaults)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ndt_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  standard_id UUID REFERENCES public.compliance_standards(id),
  joint_type VARCHAR(50),             -- 'GROOVE','FILLET','PLUG','SLOT'
  material_thickness_max_in NUMERIC,  -- inches
  required_ndt_types JSONB NOT NULL DEFAULT '["VISUAL"]'::jsonb, -- ['VISUAL','RADIOGRAPHIC','ULTRASONIC']
  sampling_rate VARCHAR(50) NOT NULL DEFAULT '100%',
  is_default BOOLEAN NOT NULL DEFAULT false, -- org-wide default when project_id IS NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ndt_requirements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ndt_requirements' AND policyname='ndt_requirements_org_select') THEN
    CREATE POLICY ndt_requirements_org_select ON public.ndt_requirements FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ndt_requirements' AND policyname='ndt_requirements_org_insert') THEN
    CREATE POLICY ndt_requirements_org_insert ON public.ndt_requirements FOR INSERT TO authenticated
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ndt_requirements' AND policyname='ndt_requirements_org_update') THEN
    CREATE POLICY ndt_requirements_org_update ON public.ndt_requirements FOR UPDATE TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()))
    WITH CHECK (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- SECTION 12: ADD COLUMN to existing tables
-- ============================================================

-- weld_photos: add annotation_data JSONB
DO $$ BEGIN
  ALTER TABLE public.weld_photos ADD COLUMN annotation_data JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- nde_selections: add source column with check constraint
DO $$ BEGIN
  ALTER TABLE public.nde_selections ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'sampled'
    CHECK (source IN ('sampled','manual','auto_trigger'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- SECTION 13: Seed code_registry with AWS D1.1 entries
-- ============================================================

INSERT INTO public.code_registry (standard, edition, label, regions, active)
VALUES
  ('AWS D1.1', '2025', 'AWS D1.1:2025 Structural Welding Code — Steel', ARRAY['US','CA'], true),
  ('AWS D1.1', '2020', 'AWS D1.1:2020 Structural Welding Code — Steel', ARRAY['US','CA'], true)
ON CONFLICT (standard, edition) DO NOTHING;

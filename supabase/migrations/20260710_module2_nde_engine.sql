-- ============================================================
-- Module 2: NDE Engine
-- Non-destructive examination plans, code profiles, and
-- deterministic weld selection records.
-- ============================================================

-- nde_code_profiles: org-specific NDE code profile
-- ALL numeric defaults are ENGINEERING_REVIEW_REQUIRED
CREATE TABLE IF NOT EXISTS public.nde_code_profiles (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_name              text NOT NULL,
  sampling_pct_rt           numeric NOT NULL DEFAULT 10,   -- ENGINEERING_REVIEW_REQUIRED
  sampling_pct_ut           numeric NOT NULL DEFAULT 10,   -- ENGINEERING_REVIEW_REQUIRED
  progressive_trigger_count integer NOT NULL DEFAULT 1,    -- ENGINEERING_REVIEW_REQUIRED
  progressive_add_pct       numeric NOT NULL DEFAULT 20,   -- ENGINEERING_REVIEW_REQUIRED
  acceptance_standard       text NOT NULL DEFAULT 'B31.3', -- ENGINEERING_REVIEW_REQUIRED
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- RLS: org members read/insert/update their own
ALTER TABLE public.nde_code_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nde_code_profiles_org" ON public.nde_code_profiles
  USING (organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());

-- nde_plans: one plan per project per period
CREATE TABLE IF NOT EXISTS public.nde_plans (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code_profile_id uuid NOT NULL REFERENCES public.nde_code_profiles(id) ON DELETE RESTRICT,
  plan_date       date NOT NULL DEFAULT CURRENT_DATE,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  created_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nde_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nde_plans_org" ON public.nde_plans
  USING (organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());
CREATE INDEX IF NOT EXISTS idx_nde_plans_project ON public.nde_plans(project_id);

-- nde_selections: deterministic selection output (append-only in practice)
CREATE TABLE IF NOT EXISTS public.nde_selections (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nde_plan_id      uuid NOT NULL REFERENCES public.nde_plans(id) ON DELETE CASCADE,
  weld_id          uuid NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  inspection_type  text NOT NULL CHECK (inspection_type IN ('RT','UT','VT','PT','MT')),
  selection_seed   text NOT NULL,   -- SHA-256 seed stored for auditor re-verification
  selection_rank   integer NOT NULL, -- position in deterministic sort
  selection_reason text NOT NULL,   -- 'random_sample' | 'progressive_penalty' | 'repair_followup'
  result           text CHECK (result IN ('pass','fail','pending')),
  result_notes     text,
  result_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nde_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nde_selections_org" ON public.nde_selections
  USING (organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());
CREATE INDEX IF NOT EXISTS idx_nde_selections_plan ON public.nde_selections(nde_plan_id);
CREATE INDEX IF NOT EXISTS idx_nde_selections_weld ON public.nde_selections(weld_id);

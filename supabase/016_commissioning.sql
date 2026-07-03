-- 016_commissioning.sql
-- System Turnover Packages, Pre-commissioning Checklists, Handover Certificates

-- ── System Turnover Packages ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_turnover_packages (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id           uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stp_number           text NOT NULL,
  system_name          text NOT NULL,
  system_description   text,
  discipline           text CHECK (discipline IN (
                         'mechanical','piping','electrical','instrumentation',
                         'civil','structural','hvac','process','all')),
  status               text NOT NULL DEFAULT 'not_started'
                         CHECK (status IN (
                           'not_started','pre_comm_in_progress','pre_comm_complete',
                           'comm_in_progress','comm_complete','accepted')),
  pre_comm_target_date date,
  comm_target_date     date,
  handover_date        date,
  responsible_engineer text,
  client_rep           text,
  notes                text,
  created_by           uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, stp_number)
);

CREATE INDEX IF NOT EXISTS idx_stp_org     ON public.system_turnover_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_stp_project ON public.system_turnover_packages(project_id);

ALTER TABLE public.system_turnover_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stp_select" ON public.system_turnover_packages;
DROP POLICY IF EXISTS "stp_insert" ON public.system_turnover_packages;
DROP POLICY IF EXISTS "stp_update" ON public.system_turnover_packages;
DROP POLICY IF EXISTS "stp_delete" ON public.system_turnover_packages;

CREATE POLICY "stp_select" ON public.system_turnover_packages FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "stp_insert" ON public.system_turnover_packages FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "stp_update" ON public.system_turnover_packages FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "stp_delete" ON public.system_turnover_packages FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

-- ── Pre-commissioning Checklist Items ────────────────────────
CREATE TABLE IF NOT EXISTS public.precomm_items (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stp_id            uuid NOT NULL REFERENCES public.system_turnover_packages(id) ON DELETE CASCADE,
  sequence_no       integer NOT NULL DEFAULT 0,
  activity          text NOT NULL,
  description       text,
  discipline        text,
  responsible_party text,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_progress','complete','na','rejected')),
  completed_by      text,
  completed_date    date,
  verified_by       text,
  verified_date     date,
  comments          text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_precomm_stp ON public.precomm_items(stp_id);
CREATE INDEX IF NOT EXISTS idx_precomm_org ON public.precomm_items(organization_id);

ALTER TABLE public.precomm_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "precomm_select" ON public.precomm_items;
DROP POLICY IF EXISTS "precomm_insert" ON public.precomm_items;
DROP POLICY IF EXISTS "precomm_update" ON public.precomm_items;
DROP POLICY IF EXISTS "precomm_delete" ON public.precomm_items;

CREATE POLICY "precomm_select" ON public.precomm_items FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "precomm_insert" ON public.precomm_items FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "precomm_update" ON public.precomm_items FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "precomm_delete" ON public.precomm_items FOR DELETE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());

-- ── Handover Certificates ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.handover_certificates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stp_id          uuid NOT NULL REFERENCES public.system_turnover_packages(id) ON DELETE CASCADE,
  cert_number     text NOT NULL,
  cert_type       text NOT NULL CHECK (cert_type IN (
                    'mechanical_completion','pre_commissioning','commissioning',
                    'performance_test','final_acceptance')),
  issued_date     date,
  accepted_date   date,
  contractor_rep  text,
  client_rep      text,
  notes           text,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','issued','accepted','rejected')),
  created_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handover_stp ON public.handover_certificates(stp_id);
CREATE INDEX IF NOT EXISTS idx_handover_org ON public.handover_certificates(organization_id);

ALTER TABLE public.handover_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "handover_select" ON public.handover_certificates;
DROP POLICY IF EXISTS "handover_insert" ON public.handover_certificates;
DROP POLICY IF EXISTS "handover_update" ON public.handover_certificates;
DROP POLICY IF EXISTS "handover_delete" ON public.handover_certificates;

CREATE POLICY "handover_select" ON public.handover_certificates FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "handover_insert" ON public.handover_certificates FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "handover_update" ON public.handover_certificates FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "handover_delete" ON public.handover_certificates FOR DELETE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());

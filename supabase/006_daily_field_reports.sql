-- 006_daily_field_reports.sql
CREATE TABLE IF NOT EXISTS public.daily_field_reports (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date      date NOT NULL DEFAULT CURRENT_DATE,
  report_number    text NOT NULL,          -- e.g. DFR-2026-0001
  supervisor_name  text,
  crew_size        integer DEFAULT 0,
  weather          text CHECK (weather IN ('clear','cloudy','rain','snow','wind','extreme_heat','fog')),
  temperature      text,
  work_areas       text,                   -- free text, comma separated areas
  work_completed   text NOT NULL,
  equipment_used   text,
  materials_used   text,
  issues_delays    text,
  safety_incidents text,
  visitors         text,
  welds_completed  integer DEFAULT 0,
  spools_completed integer DEFAULT 0,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','approved')),
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_by      uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_dfr_org     ON public.daily_field_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_dfr_project ON public.daily_field_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_dfr_date    ON public.daily_field_reports(report_date DESC);

ALTER TABLE public.daily_field_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dfr_select" ON public.daily_field_reports;
DROP POLICY IF EXISTS "dfr_insert" ON public.daily_field_reports;
DROP POLICY IF EXISTS "dfr_update" ON public.daily_field_reports;
DROP POLICY IF EXISTS "dfr_delete" ON public.daily_field_reports;

CREATE POLICY "dfr_select" ON public.daily_field_reports FOR SELECT
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "dfr_insert" ON public.daily_field_reports FOR INSERT
  WITH CHECK (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "dfr_update" ON public.daily_field_reports FOR UPDATE
  USING (public.is_platform_admin() OR organization_id = public.my_org_id());
CREATE POLICY "dfr_delete" ON public.daily_field_reports FOR DELETE
  USING (public.is_platform_admin() OR (organization_id = public.my_org_id() AND public.is_org_admin()));

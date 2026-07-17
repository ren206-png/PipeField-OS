-- Module 1: Welder Qualification + Continuity Enforcement
-- continuity_groups and continuity_items tables

CREATE TABLE IF NOT EXISTS public.continuity_groups (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  -- ENGINEERING_REVIEW_REQUIRED: window_hours is a conservative placeholder.
  -- Verify against your governing code (ASME B31.3 cl.328.2, B31.1, API 1104 S6)
  -- and your client specification before activating QUAL_ENFORCEMENT.
  window_hours       NUMERIC NOT NULL DEFAULT 6,
  created_by         UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.continuity_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "continuity_groups_org" ON public.continuity_groups
  FOR ALL USING (organization_id = get_my_org_id());

CREATE TABLE IF NOT EXISTS public.continuity_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id           UUID NOT NULL REFERENCES public.continuity_groups(id) ON DELETE CASCADE,
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weld_id            UUID NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  added_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.continuity_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "continuity_items_org" ON public.continuity_items
  FOR ALL USING (organization_id = get_my_org_id());

CREATE INDEX IF NOT EXISTS idx_continuity_items_group ON public.continuity_items(group_id);
CREATE INDEX IF NOT EXISTS idx_continuity_items_weld  ON public.continuity_items(weld_id);

-- Add qualification_flag to welds (permanent marker, cleared only by override)
ALTER TABLE public.welds
  ADD COLUMN IF NOT EXISTS qualification_flag TEXT DEFAULT NULL;

COMMENT ON COLUMN public.welds.qualification_flag IS
  'Set when qual check fails in FLAG mode. Cleared by supervisor override '
  '(but the original weld_events rows are permanent and cannot be deleted).';

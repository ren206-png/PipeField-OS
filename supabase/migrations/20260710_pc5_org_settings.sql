-- PC-5: Organization settings for Tier 1 enforcement modes

CREATE TABLE IF NOT EXISTS public.org_settings (
  organization_id           UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Feature enforcement modes
  qual_enforcement_mode     TEXT NOT NULL DEFAULT 'FLAG'
                            CHECK (qual_enforcement_mode IN ('HARD_BLOCK', 'FLAG', 'OFF')),
  nde_engine_mode           TEXT NOT NULL DEFAULT 'OFF'
                            CHECK (nde_engine_mode IN ('ACTIVE', 'OFF')),
  -- ENGINEERING_REVIEW_REQUIRED: continuity_window_hours is a conservative
  -- placeholder default. Verify against your governing code (ASME B31.3 cl.328.2,
  -- B31.1 cl.127.5, API 1104 S6) and client specification before activating
  -- QUAL_ENFORCEMENT.
  continuity_window_hours   NUMERIC NOT NULL DEFAULT 6,  -- ENGINEERING_REVIEW_REQUIRED
  -- Updated by
  updated_by                UUID REFERENCES public.user_profiles(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only admins can read/write org settings
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_settings_read" ON public.org_settings
  FOR SELECT USING (organization_id = get_my_org_id());

CREATE POLICY "org_settings_admin_write" ON public.org_settings
  FOR ALL USING (organization_id = get_my_org_id() AND get_my_role() IN ('admin', 'platform_admin'));

COMMENT ON COLUMN public.org_settings.continuity_window_hours IS
  'ENGINEERING_REVIEW_REQUIRED: Default 6h is a placeholder. '
  'Verify against governing code and client spec before activating enforcement.';

-- ============================================================
-- Migration: 20260815_org_feature_flags
-- Per-tenant feature flag overrides.
-- Resolution order: this table > process env var > hard default.
--
-- This allows orgs to opt-in to capabilities (e.g. NDE enforcement,
-- qual enforcement) independently, without requiring a full redeployment.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flag_name   TEXT NOT NULL,
    -- Must be a valid FlagName from src/intelligence/flags.ts
  enabled     BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB,
    -- Flag-specific config, e.g. { "continuity_window_days": 180 }
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, flag_name)
);

CREATE INDEX IF NOT EXISTS org_feature_flags_org_id_idx ON public.org_feature_flags(org_id);

COMMENT ON TABLE public.org_feature_flags IS
  'Per-tenant feature flag overrides. '
  'An entry here takes precedence over the process-level env var for that flag. '
  'Absence of an entry means fall through to the env var / hard default.';

COMMENT ON COLUMN public.org_feature_flags.metadata IS
  'Optional flag-specific config. Example: '
  '{ "continuity_window_days": 180 } for the PFOS_QUAL_ENFORCEMENT flag.';

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.org_feature_flags ENABLE ROW LEVEL SECURITY;

-- Any org member can read their org's flag overrides
CREATE POLICY "org_flags_read" ON public.org_feature_flags
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- Only org admins can write flag overrides
CREATE POLICY "org_flags_write" ON public.org_feature_flags
  FOR ALL USING (
    org_id IN (
      SELECT organization_id FROM user_profiles
      WHERE auth_user_id = auth.uid()
        AND role IN ('platform_admin','organization_owner','administrator')
    )
  );

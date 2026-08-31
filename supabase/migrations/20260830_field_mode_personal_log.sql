-- ============================================================
-- Field Mode — Personal Work Log
-- Append-only log scoped to tenant_id + auth_user_id.
-- Corrections are new rows referencing the original row_id.
-- No UPDATE policy exists by design.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.personal_work_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant and user scope
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  auth_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What was logged
  event_type        TEXT NOT NULL CHECK (event_type IN ('welded', 'fit_up', 'note', 'correction')),
  weld_id           UUID REFERENCES public.welds(id) ON DELETE SET NULL,
  spool_id          UUID REFERENCES public.spools(id) ON DELETE SET NULL,

  -- Human-readable snapshot at time of logging (project name only — no client, no pricing)
  project_name      TEXT,          -- denormalized snapshot, not a FK
  joint_number      TEXT,
  weld_process      TEXT,
  welder_stamp      TEXT,

  -- NDE result: only populated when QC releases it (Phase 3 sync path)
  nde_result        TEXT CHECK (nde_result IN ('pass', 'fail', 'pending', NULL)),
  nde_released_at   TIMESTAMPTZ,

  -- Free-text note (optional)
  note              TEXT,

  -- Correction chain: if this row corrects a previous row, reference it
  corrects_row_id   UUID REFERENCES public.personal_work_log(id) ON DELETE SET NULL,

  -- Source: manual, scan, voice
  source            TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'scan', 'voice')),

  -- Timestamps (immutable)
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_personal_log_user
  ON public.personal_work_log(auth_user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_personal_log_org_user
  ON public.personal_work_log(organization_id, auth_user_id, logged_at DESC);

-- RLS
ALTER TABLE public.personal_work_log ENABLE ROW LEVEL SECURITY;

-- SELECT: user can only read their own rows
CREATE POLICY "personal_log_select_own"
  ON public.personal_work_log FOR SELECT
  USING (auth_user_id = auth.uid());

-- INSERT: user can only insert their own rows
CREATE POLICY "personal_log_insert_own"
  ON public.personal_work_log FOR INSERT
  WITH CHECK (
    auth_user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE auth_user_id = auth.uid()
    )
  );

-- NO UPDATE POLICY — rows are immutable by design
-- NO DELETE POLICY — rows are immutable by design

COMMENT ON TABLE public.personal_work_log IS
  'Append-only personal work log scoped to each worker. '
  'No UPDATE or DELETE policies exist by design. '
  'Corrections are new rows with corrects_row_id set.';

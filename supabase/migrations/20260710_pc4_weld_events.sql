-- PC-4: Immutable weld event ledger
-- Append-only: INSERT only. No UPDATE. No DELETE.
-- Every weld status change, qualification check, NDE selection, and override
-- is recorded here permanently. Corrections are new rows superseding old ones.

CREATE TABLE IF NOT EXISTS public.weld_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  weld_id         UUID NOT NULL REFERENCES public.welds(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'created',
    'status_changed',
    'qual_checked',
    'qual_passed',
    'qual_flagged',
    'qual_blocked',
    'qual_overridden',
    'nde_selected',
    'nde_result_pass',
    'nde_result_fail',
    'nde_progressive_penalty',
    'heat_assigned',
    'continuity_checked',
    'continuity_passed',
    'continuity_flagged',
    'repair_linked',
    'turnover_included'
  )),
  from_status     TEXT,
  to_status       TEXT,
  actor_id        UUID NOT NULL REFERENCES public.user_profiles(id),
  actor_role      TEXT NOT NULL,
  reason          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_weld_events_weld    ON public.weld_events(weld_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weld_events_org     ON public.weld_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weld_events_type    ON public.weld_events(organization_id, event_type, created_at DESC);

-- RLS: append-only
ALTER TABLE public.weld_events ENABLE ROW LEVEL SECURITY;

-- INSERT: any org member can write events (engine writes on their behalf)
CREATE POLICY "weld_events_insert" ON public.weld_events
  FOR INSERT WITH CHECK (organization_id = get_my_org_id());

-- SELECT: org members can read their org's event log
CREATE POLICY "weld_events_read" ON public.weld_events
  FOR SELECT USING (organization_id = get_my_org_id());

-- NO UPDATE POLICY
-- NO DELETE POLICY
-- These are intentionally absent. The ledger is immutable.

COMMENT ON TABLE public.weld_events IS
  'Append-only QC event ledger. No UPDATE or DELETE policies by design. '
  'Corrections are new rows superseding old ones — never edits.';

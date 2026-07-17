-- ============================================================
-- Migration: 20260714_grace_period
-- Adds grace_period_ends_at to track the dunning window.
--
-- When invoice.payment_failed fires, grace_period_ends_at is set
-- to NOW() + 3 days. If the org is still past_due after that date,
-- the billing lockout gate activates (read-only mode).
--
-- Cleared (set to NULL) when invoice.payment_succeeded fires.
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz;

-- Index used by the dunning cron (future Phase 5+) and by the
-- lockout check to find orgs past their grace window.
CREATE INDEX IF NOT EXISTS idx_organizations_grace_period
  ON public.organizations (grace_period_ends_at)
  WHERE grace_period_ends_at IS NOT NULL;

COMMENT ON COLUMN public.organizations.grace_period_ends_at IS
  'Set to NOW()+3 days on first invoice.payment_failed. '
  'Cleared on invoice.payment_succeeded. '
  'Org enters read-only lockout when past_due AND grace_period_ends_at < NOW().';

-- ============================================================
-- Migration: 20260815_nde_seed_column
-- Add seed_hex to nde_selections so each selection run's seed
-- is persisted for audit reproducibility (Risk R2 fix).
--
-- Background: the NDE selection engine previously seeded with
-- Date.now(), making re-runs on a different calendar day produce
-- a different ranked order for the same plan. The engine now
-- seeds deterministically from (nde_plan_id + inspection_type).
-- Persisting the seed here allows any future replay to use the
-- original seed rather than recomputing it.
-- ============================================================

ALTER TABLE public.nde_selections
  ADD COLUMN IF NOT EXISTS seed_hex TEXT;

COMMENT ON COLUMN public.nde_selections.seed_hex IS
  'SHA-256 hex seed used for this selection run. '
  'Seeded from (nde_plan_id || inspection_type) — time-independent. '
  'Store at insert time so audits are reproducible regardless of when re-run.';

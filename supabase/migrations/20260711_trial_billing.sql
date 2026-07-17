-- Phase 1: Trial billing fields — additive only, all nullable/defaulted
-- Existing rows remain valid. Safe to re-run (idempotent).

-- trial_ends_at: set at subscription creation, null for pre-trial orgs
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- plan_price_id: Stripe Price ID for the plan they signed up for
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_price_id text;

-- trial_notification_sent: tracks which milestone notifications have been sent
-- JSON object: { "day7": bool, "day11": bool, "day13": bool }
-- Prevents duplicate emails if cron reruns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_notifications_sent jsonb NOT NULL DEFAULT '{}';

-- Ensure stripe_customer_id is unique (if UNIQUE constraint doesn't exist yet)
-- Use DO block to avoid error if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_stripe_customer_id_key'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_stripe_customer_id_key
      UNIQUE (stripe_customer_id);
  END IF;
END $$;

-- Index for trial expiry cron job
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at
  ON public.organizations(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL
    AND subscription_status = 'trialing';
